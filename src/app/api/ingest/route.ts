import { embedText } from "@/lib/ai/embeddings";
import { requireUser } from "@/lib/auth/require-user";
import { enforceRateLimit } from "@/lib/rate-limit";
import { insertChunks } from "@/lib/repositories/chunks";
import { createDocument, setStatus } from "@/lib/repositories/documents";
import { ingestSchema, parseJsonBody } from "@/lib/validation";
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
    const auth = await requireUser();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const limited = await enforceRateLimit(auth.user.id, "ingest");
    if (limited) return limited;

    const parsed = await parseJsonBody(request, ingestSchema);
    if (!parsed.ok) return parsed.response;

    const { title, text, metadata } = parsed.data;
    const userId = auth.user.id;

    // Whitespace-only input is truthy but chunks to nothing; previously this
    // produced a PROCESSED document with zero searchable chunks.
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
      // Full text, not a 10k truncation.
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
