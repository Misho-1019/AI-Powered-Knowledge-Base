import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createDocument } from "@/lib/repositories/documents";

/**
 * Creates a document row for an already-uploaded object.
 *
 * NOTE: `storagePath` is still client-supplied here. Prefix validation against
 * the caller's own id, plus an object-existence check, lands in Phase 5.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const title = body?.title;
    const storagePath = body?.storagePath;
    const originalFilename = body?.originalFilename;

    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid title" },
        { status: 400 },
      );
    }

    if (!storagePath || typeof storagePath !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid storagePath" },
        { status: 400 },
      );
    }

    const auth = await requireUser();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const doc = await createDocument({
      userId: auth.user.id,
      title,
      storagePath,
      status: "PENDING",
      metadata: {
        source: "upload",
        originalFilename:
          typeof originalFilename === "string" ? originalFilename : null,
      },
    });

    return NextResponse.json({ ok: true, documentId: doc.id });
  } catch (err) {
    console.error("[documents] create failed:", err);
    return NextResponse.json(
      { error: "Could not create document" },
      { status: 500 },
    );
  }
}
