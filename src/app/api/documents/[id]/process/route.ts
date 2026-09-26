import { embedMany } from "@/lib/ai/embeddings";
import { generateAndStoreSuggestions } from "@/lib/ai/suggestions";
import { requireUser } from "@/lib/auth/require-user";
import { chunkText, estimateTokens } from "@/lib/chunk";
import { LIMITS } from "@/lib/config";
import { enforceRateLimit } from "@/lib/rate-limit";
import { replaceChunks } from "@/lib/repositories/chunks";
import { getDocument, setStatus } from "@/lib/repositories/documents";
import { downloadObject } from "@/lib/storage";
import { logger, requestIdFrom } from "@/lib/log";
import { NextResponse, after } from "next/server";

import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Longest any single invocation may run on Vercel. */
export const maxDuration = 300;

function getExt(path: string) {
  const lower = path.toLowerCase();
  const idx = lower.lastIndexOf(".");
  return idx >= 0 ? lower.slice(idx + 1) : "";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const log = logger(requestIdFrom(request));
  const { id } = await params;

  const auth = await requireUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const userId = auth.user.id;

  const limited = await enforceRateLimit(userId, "process");
  if (limited) return limited;

  // Ownership is enforced in the query: a document belonging to another user
  // is indistinguishable from one that does not exist.
  const doc = await getDocument(userId, id).catch((err) => {
    log.error("[process] lookup failed", { error: err });
    return null;
  });

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (!doc.storagePath) {
    return NextResponse.json(
      { error: "Document has no storage path to process" },
      { status: 400 },
    );
  }

  try {
    await setStatus(userId, id, "PROCESSING");

    const buffer = await downloadObject(doc.storagePath);
    const ext = getExt(doc.storagePath);
    let text = "";

    if (ext === "pdf") {
      const tmpPath = join(tmpdir(), `${randomUUID()}.pdf`);
      await writeFile(tmpPath, buffer);

      try {
        const { stdout } = await execFileAsync(
          process.execPath,
          [
            join(process.cwd(), "scripts", "extract-pdf-text.mjs"),
            tmpPath,
            String(LIMITS.maxPdfPages),
          ],
          { maxBuffer: 10 * 1024 * 1024 },
        );
        text = (stdout ?? "").toString();
      } catch (err) {
        // Surface the script's own message (e.g. its page-count refusal)
        // instead of a generic exec failure.
        const stderr = (err as { stderr?: string })?.stderr?.trim();
        throw new Error(stderr || "Could not extract text from this PDF");
      } finally {
        await unlink(tmpPath).catch(() => {});
      }
    } else if (ext === "txt" || ext === "md") {
      text = buffer.toString("utf-8");
    } else {
      throw new Error(`Unsupported file type: .${ext}`);
    }

    text = text.trim();
    if (!text) {
      throw new Error("No text could be extracted from this file");
    }

    const chunks = chunkText(text);
    if (chunks.length === 0) {
      throw new Error("No indexable content found in this document");
    }

    const vectors = await embedMany(chunks.map((c) => c.text));

    const rows = chunks.map((chunk, index) => ({
      documentId: id,
      userId,
      chunkIndex: index,
      textChunk: chunk.text,
      embedding: vectors[index],
      tokenCount: estimateTokens(chunk.text),
      charStart: chunk.charStart,
    }));

    // Atomic swap: the previous chunks survive unless this fully succeeds.
    // Replaces the old delete-then-insert that could wipe a working index.
    await replaceChunks(userId, id, rows);

    await setStatus(userId, id, "PROCESSED");

    // Suggested questions are a side effect, not part of indexing. They run
    // after the response so a slow or missing LLM never delays the upload,
    // and they are best-effort: failure leaves the document PROCESSED.
    after(async () => {
      await generateAndStoreSuggestions({
        userId,
        documentId: id,
        title: doc.title,
        chunks: chunks.map((c) => c.text),
        log,
      });
    });

    return NextResponse.json({
      ok: true,
      documentId: id,
      chunkCount: chunks.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    log.error("[process] failed", { error: message });

    // Record the failure instead of silently reverting to PENDING, which is
    // what made broken ingests invisible.
    await setStatus(userId, id, "FAILED", message).catch((statusErr) => {
      log.error("[process] could not record FAILED status", {
        error: statusErr,
      });
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
