import { embedMany } from "@/lib/ai/embeddings";
import { generateAndStoreSuggestions } from "@/lib/ai/suggestions";
import { requireUser } from "@/lib/auth/require-user";
import { chunkText, estimateTokens } from "@/lib/chunk";
import { enforceRateLimit } from "@/lib/rate-limit";
import { insertChunks } from "@/lib/repositories/chunks";
import { createDocument, setStatus } from "@/lib/repositories/documents";
import { ingestSchema, parseJsonBody } from "@/lib/validation";
import { logger, requestIdFrom } from "@/lib/log";
import { NextResponse, after } from "next/server";

/** Embedding a long note can exceed the default serverless budget. */
export const maxDuration = 300;

export async function POST(request: Request) {
  const log = logger(requestIdFrom(request));

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

      // Best-effort and non-blocking: see the /process route for why this
      // lives in `after()` rather than on the request path.
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
      log.error("[ingest] failed", { error: message });
      await setStatus(userId, doc.id, "FAILED", message).catch(() => {});
      return NextResponse.json({ error: message }, { status: 500 });
    }
  } catch (error) {
    log.error("[ingest] unexpected error", { error });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
