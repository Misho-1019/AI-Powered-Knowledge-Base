import { runRag } from "@/lib/services/ragService";
import { requireUser } from "@/lib/auth/require-user";
import { enforceRateLimit } from "@/lib/rate-limit";
import { askSchema, parseJsonBody } from "@/lib/validation";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const limited = await enforceRateLimit(auth.user.id, "ask");
    if (limited) return limited;

    const parsed = await parseJsonBody(request, askSchema);
    if (!parsed.ok) return parsed.response;

    const { query, k, documentId } = parsed.data;

    const result = await runRag({
      userId: auth.user.id,
      query,
      k: k ?? 5,
      minSimilarity: 0.35,
      documentId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[ask] unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
