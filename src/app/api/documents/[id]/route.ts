import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { logger, requestIdFrom } from "@/lib/log";
import { deleteDocument, getDocument } from "@/lib/repositories/documents";
import { deleteObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Deletes a document: its chunks, its stored object, and its row.
 *
 * ORDERING MATTERS. The object is removed FIRST, then the row. That preserves
 * the invariant "a document row implies its object exists". If the object
 * delete fails we return 500 and deliberately KEEP the row, so the user can
 * retry — rather than deleting the row and leaking the file in R2 forever,
 * which is exactly how orphans accumulated before this endpoint existed.
 *
 * Chunks need no explicit delete: they cascade from the document row.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const log = logger(requestIdFrom(request));

  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const userId = auth.user.id;

    // Ownership is enforced in the query, so another user's id is "not found".
    const doc = await getDocument(userId, id);

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    let objectDeleted = false;

    if (doc.storagePath) {
      try {
        await deleteObject(doc.storagePath);
        objectDeleted = true;
      } catch (err) {
        log.error("[documents/delete] object delete failed", { error: err });
        return NextResponse.json(
          {
            error:
              "Could not remove the stored file, so the document was kept. Please try again.",
          },
          { status: 500 },
        );
      }
    }

    const removed = await deleteDocument(userId, id);

    if (!removed) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, objectDeleted });
  } catch (err) {
    log.error("[documents/delete] failed", { error: err });
    return NextResponse.json(
      { error: "Could not delete the document" },
      { status: 500 },
    );
  }
}
