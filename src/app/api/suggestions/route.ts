import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import {
  getDocument,
  getDocumentSuggestions,
  listDocumentSuggestions,
} from "@/lib/repositories/documents";

export const dynamic = "force-dynamic";

const MAX_SUGGESTIONS = 6;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Round-robin across per-document lists so the "all documents" scope shows a
 * mix rather than one document's whole list.
 */
function interleave(lists: string[][], cap: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (let index = 0; ; index++) {
    let advanced = false;

    for (const list of lists) {
      const candidate = list[index];
      if (typeof candidate !== "string") continue;

      advanced = true;
      const key = candidate.toLowerCase();
      if (seen.has(key)) continue;

      seen.add(key);
      out.push(candidate);
      if (out.length >= cap) return out;
    }

    if (!advanced) return out;
  }
}

/**
 * Suggested questions for the current scope: one document's questions, or a
 * mix across all of the caller's documents. Everything is read from
 * `documents.metadata`, so this is a cheap indexed read with no LLM cost.
 */
export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const documentId = new URL(request.url).searchParams.get("documentId");

  try {
    if (documentId) {
      if (!UUID_RE.test(documentId)) {
        return NextResponse.json(
          { error: "Invalid documentId" },
          { status: 400 },
        );
      }

      // Same ownership rule as every other read: another user's id is 404.
      const doc = await getDocument(auth.user.id, documentId);
      if (!doc) {
        return NextResponse.json(
          { error: "Document not found" },
          { status: 404 },
        );
      }

      const questions = await getDocumentSuggestions(
        auth.user.id,
        documentId,
      );
      return NextResponse.json({
        ok: true,
        questions: questions.slice(0, MAX_SUGGESTIONS),
      });
    }

    const rows = await listDocumentSuggestions(auth.user.id);
    return NextResponse.json({
      ok: true,
      questions: interleave(
        rows.map((row) => row.questions),
        MAX_SUGGESTIONS,
      ),
    });
  } catch (err) {
    console.error("[suggestions] failed:", err);
    return NextResponse.json(
      { error: "Could not load suggestions" },
      { status: 500 },
    );
  }
}
