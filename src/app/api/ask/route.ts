import { runRag } from "@/lib/services/ragService";
import { requireUser } from "@/lib/auth/require-user";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const query = body?.query;
    const k = typeof body?.k === "number" ? body.k : 5;
    const documentId =
      typeof body?.documentId === "string" && body.documentId.length > 0
        ? body.documentId
        : undefined;

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

    const result = await runRag({
      userId: auth.user.id,
      query,
      k,
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
