import { embedText } from "@/lib/ai/embeddings";
import { requireUser } from "@/lib/auth/require-user";
import { matchChunks } from "@/lib/repositories/search";
import { NextResponse } from "next/server";

/**
 * Retrieval-only endpoint: returns matching chunks without invoking the LLM.
 * `/api/ask` builds on the same repository for the full answer path.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const query = body?.query;
    const k = typeof body?.k === "number" ? body.k : 5;
    const documentId =
      typeof body?.documentId === "string" && body.documentId.length > 0
        ? body.documentId
        : null;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid query" },
        { status: 400 },
      );
    }

    const auth = await requireUser();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const queryEmbedding = await embedText(query);
    const matches = await matchChunks({
      userId: auth.user.id,
      embedding: queryEmbedding,
      limit: k,
      documentId,
    });

    return NextResponse.json({ ok: true, matches });
  } catch (err) {
    console.error("[query] failed:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
