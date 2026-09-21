import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { listDocuments } from "@/lib/repositories/documents";

export const dynamic = "force-dynamic";

export async function GET() {
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
      })),
    });
  } catch (err) {
    console.error("[documents/list] failed:", err);
    return NextResponse.json(
      { error: "Could not load documents" },
      { status: 500 },
    );
  }
}
