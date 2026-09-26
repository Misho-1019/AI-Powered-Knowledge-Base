import { NextResponse } from "next/server";
import { logger, requestIdFrom } from "@/lib/log";
import { requireUser } from "@/lib/auth/require-user";
import { createDocument, listDocuments } from "@/lib/repositories/documents";
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

export const dynamic = "force-dynamic";

/**
 * Lists the caller's documents with their suggested questions embedded.
 * Replaces the old `/api/documents/list` endpoint (same data, one fewer
 * function) — the Ask page builds both its scope dropdown and its chips
 * from this single response.
 */
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
        suggestions: d.suggestions,
      })),
    });
  } catch (err) {
    log.error("[documents] list failed", { error: err });
    return NextResponse.json(
      { error: "Could not load documents" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const log = logger(requestIdFrom(request));

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
    log.error("[documents] create failed", { error: err });
    return NextResponse.json(
      { error: "Could not create document" },
      { status: 500 },
    );
  }
}
