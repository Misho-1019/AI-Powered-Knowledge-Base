import { embedText } from "@/lib/ai/embeddings";
import { requireUser } from "@/lib/auth/require-user";
import { insertChunks } from "@/lib/repositories/chunks";
import { createDocument, setStatus } from "@/lib/repositories/documents";
import { NextResponse } from "next/server";

function chunkText(text: string, chunkSize = 1500, overlap = 300) {
  const clean = (text ?? "").trim();
  if (!clean) return [];

  const size = Math.max(200, Math.floor(chunkSize));
  const ov = Math.max(0, Math.floor(overlap));
  const safeOverlap = Math.min(ov, size - 1);

  const chunks: string[] = [];
  let start = 0;
  const MAX_CHUNKS = 2000;

  while (start < clean.length && chunks.length < MAX_CHUNKS) {
    const end = Math.min(start + size, clean.length);
    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push(piece);

    if (end === clean.length) break;

    const nextStart = end - safeOverlap;
    start = nextStart <= start ? end : nextStart;
  }

  if (chunks.length >= MAX_CHUNKS) {
    throw new Error("Document too large for MVP chunking (exceeded MAX_CHUNKS).");
  }

  return chunks;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { title, text, metadata } = body as {
      title?: string;
      text?: string;
      metadata?: Record<string, unknown>;
    };

    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid title" },
        { status: 400 },
      );
    }

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid text" },
        { status: 400 },
      );
    }

    const auth = await requireUser();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const userId = auth.user.id;

    // Guard before creating anything: whitespace-only input is truthy but
    // chunks to nothing. Previously this produced a PROCESSED document with
    // zero searchable chunks.
    const chunks = chunkText(text, 1500, 300);
    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "Text contains no indexable content" },
        { status: 400 },
      );
    }

    const doc = await createDocument({
      userId,
      title,
      // Full text, not a 10k truncation — the previous cut-off silently
      // discarded content that was nevertheless chunked and embedded.
      content: text,
      status: "PROCESSING",
      metadata: metadata ?? {},
    });

    try {
      const rows = [];
      for (let idx = 0; idx < chunks.length; idx++) {
        const c = chunks[idx];
        const embedding = await embedText(c);

        rows.push({
          documentId: doc.id,
          userId,
          chunkIndex: idx,
          textChunk: c,
          embedding,
          tokenCount: Math.max(1, Math.ceil(c.length / 4)),
        });
      }

      await insertChunks(rows);
      await setStatus(userId, doc.id, "PROCESSED");

      return NextResponse.json({
        ok: true,
        documentId: doc.id,
        chunkCount: chunks.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ingestion failed";
      console.error("[ingest] failed:", message);
      await setStatus(userId, doc.id, "FAILED", message).catch(() => {});
      return NextResponse.json({ error: message }, { status: 500 });
    }
  } catch (error) {
    console.error("[ingest] unexpected error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
