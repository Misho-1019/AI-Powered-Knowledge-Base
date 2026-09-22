import { embedText } from "@/lib/ai/embeddings";
import { requireUser } from "@/lib/auth/require-user";
import { enforceRateLimit } from "@/lib/rate-limit";
import { deleteChunksByDocument, insertChunks } from "@/lib/repositories/chunks";
import { getDocument, setStatus } from "@/lib/repositories/documents";
import { downloadObject } from "@/lib/storage";
import { MAX_PDF_PAGES } from "@/lib/validation";
import { NextResponse } from "next/server";

import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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
    throw new Error("Document too large for MVP processing (exceeded MAX_CHUNKS).");
  }

  return chunks;
}

function getExt(path: string) {
  const lower = path.toLowerCase();
  const idx = lower.lastIndexOf(".");
  return idx >= 0 ? lower.slice(idx + 1) : "";
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
    console.error("[process] lookup failed:", err);
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
            String(MAX_PDF_PAGES),
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

    const chunks = chunkText(text, 1500, 300);

    if (chunks.length === 0) {
      throw new Error("Chunking produced no chunks");
    }

    const rows = [];
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const embedding = await embedText(c);

      rows.push({
        documentId: id,
        userId,
        chunkIndex: i,
        textChunk: c,
        embedding,
        tokenCount: Math.max(1, Math.ceil(c.length / 4)),
      });
    }

    // TODO(Phase 6): wrap delete+insert in a single transaction so a failure
    // mid-embed cannot leave the document with zero chunks.
    await deleteChunksByDocument(userId, id);
    await insertChunks(rows);

    await setStatus(userId, id, "PROCESSED");

    return NextResponse.json({
      ok: true,
      documentId: id,
      chunkCount: chunks.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    console.error("[process] failed:", message);

    // Record the failure instead of silently reverting to PENDING, which is
    // what made broken ingests invisible.
    await setStatus(userId, id, "FAILED", message).catch((statusErr) => {
      console.error("[process] could not record FAILED status:", statusErr);
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
