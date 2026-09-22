import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createDocument } from "@/lib/repositories/documents";
import { deleteObject, headObject } from "@/lib/storage";
import {
  MAX_UPLOAD_BYTES,
  createDocumentSchema,
  parseJsonBody,
} from "@/lib/validation";

/**
 * A key is only acceptable if it lives under the caller's own prefix.
 * Without this, any authenticated user could point a document row at another
 * user's object — the client-supplied-path problem.
 */
function ownsStoragePath(userId: string, storagePath: string): boolean {
  if (!storagePath.startsWith(`${userId}/`)) return false;
  if (storagePath.includes("..")) return false;
  if (storagePath.startsWith("/")) return false;
  return true;
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const parsed = await parseJsonBody(request, createDocumentSchema);
    if (!parsed.ok) return parsed.response;

    const { title, storagePath, originalFilename } = parsed.data;

    if (!ownsStoragePath(auth.user.id, storagePath)) {
      return NextResponse.json(
        { error: "Invalid storage path" },
        { status: 400 },
      );
    }

    // The object must actually exist, and must respect the size limit — the
    // server never saw the bytes, so this is the authoritative check.
    const info = await headObject(storagePath);

    if (!info) {
      return NextResponse.json(
        { error: "Uploaded object not found" },
        { status: 400 },
      );
    }

    if (info.size > MAX_UPLOAD_BYTES) {
      // Don't leave the oversized object behind.
      await deleteObject(storagePath).catch(() => {});
      return NextResponse.json(
        { error: "Uploaded object exceeds the size limit" },
        { status: 400 },
      );
    }

    const doc = await createDocument({
      userId: auth.user.id,
      title,
      storagePath,
      status: "PENDING",
      metadata: {
        source: "upload",
        originalFilename: originalFilename ?? null,
        sizeBytes: info.size,
        contentType: info.contentType,
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
