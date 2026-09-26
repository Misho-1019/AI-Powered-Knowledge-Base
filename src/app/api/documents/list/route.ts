import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { logger, requestIdFrom } from "@/lib/log";
import { listDocuments } from "@/lib/repositories/documents";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const log = logger(requestIdFrom(request));

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
    log.error("[documents/list] failed", { error: err });
    return NextResponse.json(
      { error: "Could not load documents" },
      { status: 500 },
    );
  }
}
