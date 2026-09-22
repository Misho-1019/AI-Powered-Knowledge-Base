import { embedText } from "@/lib/ai/embeddings";
import { requireUser } from "@/lib/auth/require-user";
import { enforceRateLimit } from "@/lib/rate-limit";
import { matchChunks } from "@/lib/repositories/search";
import { parseJsonBody, querySchema } from "@/lib/validation";
import { NextResponse } from "next/server";

/**
 * Retrieval-only endpoint: returns matching chunks without invoking the LLM.
 * `/api/ask` builds on the same repository for the full answer path.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const limited = await enforceRateLimit(auth.user.id, "query");
    if (limited) return limited;

    const parsed = await parseJsonBody(request, querySchema);
    if (!parsed.ok) return parsed.response;

    const { query, k, documentId } = parsed.data;

    const queryEmbedding = await embedText(query);
    const matches = await matchChunks({
      userId: auth.user.id,
      embedding: queryEmbedding,
      limit: k ?? 5,
      documentId: documentId ?? null,
    });

    return NextResponse.json({ ok: true, matches });
  } catch (err) {
    console.error("[query] failed:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
