import { embedMany } from "@/lib/ai/embeddings";
import { generateAndStoreSuggestions } from "@/lib/ai/suggestions";
import { requireUser } from "@/lib/auth/require-user";
import { chunkText, estimateTokens } from "@/lib/chunk";
import { logger, requestIdFrom } from "@/lib/log";
import { enforceRateLimit } from "@/lib/rate-limit";
import { insertChunks } from "@/lib/repositories/chunks";
import {
  createDocument,
  listDocuments,
  setStatus,
} from "@/lib/repositories/documents";
import { deleteObject, headObject } from "@/lib/storage";
import {
  MAX_UPLOAD_BYTES,
  createDocumentSchema,
  formatValidationError,
  ingestSchema,
} from "@/lib/validation";
import { NextResponse, after } from "next/server";

/**
 * A key is only acceptable if it lives under the caller's own prefix.
 * Without this, any authenticated user could point a document row at another
 * user's object — the client-supplied-path problem.
 */
function ownsStoragePath(userId: string, storagePath: string): boolean {
  if (!storagePath.startsWith(`${userId}/`)) return false;
  if (storagePath.includes("..")) return false;
  if (storagePath.startsWith("/")) return false;
  return true;
}

export const dynamic = "force-dynamic";

/** Embedding a long note can exceed the default serverless budget. */
export const maxDuration = 300;

/**
 * Lists the caller's documents with their suggested questions embedded.
 * The Ask page builds both its scope dropdown and its chips from this
 * single response.
 */
export async function GET(request: Request) {
  const log = logger(requestIdFrom(request));

  const auth = await requireUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const documents = await listDocuments(auth.user.id);

    return NextResponse.json({
      ok: true,
      documents: documents.map((d) => ({
        id: d.id,
        title: d.title,
        status: d.status,
        suggestions: d.suggestions,
      })),
    });
  } catch (err) {
    log.error("[documents] list failed", { error: err });
    return NextResponse.json(
      { error: "Could not load documents" },
      { status: 500 },
    );
  }
}

/**
 * Document intake: creates either a text note (`{ title, text }`, chunked and
 * embedded immediately) or a file row (`{ title, storagePath }`, processed
 * later via POST on the document). One endpoint, distinguished by body shape
 * — each action keeps its own validation, rate limiting, and response
 * contract, so merging them saves a function without merging their rules.
 */
export async function POST(request: Request) {
  const log = logger(requestIdFrom(request));

  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const userId = auth.user.id;

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const body =
      raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const hasText = typeof body.text === "string";
    const hasStoragePath = typeof body.storagePath === "string";

    if (hasText === hasStoragePath) {
      return NextResponse.json(
        { error: "Provide either text (note) or storagePath (file), not both" },
        { status: 400 },
      );
    }

    if (hasText) {
      return createNote(userId, body, log);
    }
    return createFileRow(userId, body, log);
  } catch (err) {
    log.error("[documents] create failed", { error: err });
    return NextResponse.json(
      { error: "Could not create document" },
      { status: 500 },
    );
  }
}

type RouteLog = ReturnType<typeof logger>;

async function createNote(
  userId: string,
  body: Record<string, unknown>,
  log: RouteLog,
) {
  const limited = await enforceRateLimit(userId, "ingest");
  if (limited) return limited;

  const parsed = ingestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: formatValidationError(parsed.error) },
      { status: 400 },
    );
  }

  const { title, text, metadata } = parsed.data;

  // Whitespace-only input is truthy but chunks to nothing; previously this
  // produced a PROCESSED document with zero searchable chunks.
  const chunks = chunkText(text);
  if (chunks.length === 0) {
    return NextResponse.json(
      { error: "Text contains no indexable content" },
      { status: 400 },
    );
  }

  const doc = await createDocument({
    userId,
    title,
    // Full text, not a 10k truncation.
    content: text,
    status: "PROCESSING",
    metadata: metadata ?? {},
  });

  try {
    const vectors = await embedMany(chunks.map((c) => c.text));

    const rows = chunks.map((chunk, index) => ({
      documentId: doc.id,
      userId,
      chunkIndex: index,
      textChunk: chunk.text,
      embedding: vectors[index],
      tokenCount: estimateTokens(chunk.text),
      charStart: chunk.charStart,
    }));

    await insertChunks(rows);
    await setStatus(userId, doc.id, "PROCESSED");

    // Best-effort and non-blocking: suggestions must never delay the ingest.
    after(async () => {
      await generateAndStoreSuggestions({
        userId,
        documentId: doc.id,
        title,
        chunks: chunks.map((c) => c.text),
        log,
      });
    });

    return NextResponse.json({
      ok: true,
      documentId: doc.id,
      chunkCount: chunks.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingestion failed";
    log.error("[documents] ingest failed", { error: message });
    await setStatus(userId, doc.id, "FAILED", message).catch(() => {});
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function createFileRow(
  userId: string,
  body: Record<string, unknown>,
  log: RouteLog,
) {
  const parsed = createDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: formatValidationError(parsed.error) },
      { status: 400 },
    );
  }

  const { title, storagePath, originalFilename } = parsed.data;

  if (!ownsStoragePath(userId, storagePath)) {
    return NextResponse.json(
      { error: "Invalid storage path" },
      { status: 400 },
    );
  }

  // The object must actually exist, and must respect the size limit — the
  // server never saw the bytes, so this is the authoritative check.
  const info = await headObject(storagePath);

  if (!info) {
    return NextResponse.json(
      { error: "Uploaded object not found" },
      { status: 400 },
    );
  }

  if (info.size > MAX_UPLOAD_BYTES) {
    // Don't leave the oversized object behind.
    await deleteObject(storagePath).catch(() => {});
    return NextResponse.json(
      { error: "Uploaded object exceeds the size limit" },
      { status: 400 },
    );
  }

  const doc = await createDocument({
    userId,
    title,
    storagePath,
    status: "PENDING",
    metadata: {
      source: "upload",
      originalFilename: originalFilename ?? null,
      sizeBytes: info.size,
      contentType: info.contentType,
    },
  });

  return NextResponse.json({ ok: true, documentId: doc.id });
}
