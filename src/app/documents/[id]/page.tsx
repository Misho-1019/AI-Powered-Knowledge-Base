import ProcessButton from "@/components/ProcessButton";
import DeleteDocButton from "@/components/DeleteDocButton";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import NoticeCard from "@/components/ui/NoticeCard";
import { requireUser } from "@/lib/auth/require-user";
import { countChunksByDocument, listChunksByDocument } from "@/lib/repositories/chunks";
import { getDocument } from "@/lib/repositories/documents";
import { unstable_rethrow } from "next/navigation";
import Link from "next/link";

const CHUNK_PAGE_SIZE = 100;

function BackLink() {
  return (
    <Link
      href="/documents"
      className="text-sm font-medium text-[var(--brand-2)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-2)]/30 focus-visible:ring-offset-2 rounded"
    >
      ← Back to documents
    </Link>
  );
}

async function loadDocumentDetail(userId: string, documentId: string) {
  try {
    // getDocument filters on user_id, so another tenant's id returns null
    // instead of confirming that the row exists.
    const doc = await getDocument(userId, documentId);
    if (!doc) return { ok: false as const, kind: "not_found" as const };

    const [chunks, chunkTotal] = await Promise.all([
      listChunksByDocument(userId, documentId, { limit: CHUNK_PAGE_SIZE }),
      countChunksByDocument(userId, documentId),
    ]);

    return { ok: true as const, doc, chunks, chunkTotal };
  } catch (err) {
    unstable_rethrow(err);
    console.error("[document detail] load failed:", err);
    return { ok: false as const, kind: "db_error" as const };
  }
}

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auth = await requireUser();

  if (!auth.ok) {
    const signedOut = auth.status === 401;
    return (
      <div className="space-y-6">
        <BackLink />
        <NoticeCard
          title={signedOut ? "Not signed in" : "Authentication unavailable"}
          description={
            signedOut
              ? "You need an account to view this document."
              : "The authentication service could not be reached. This is a server-side problem, not a problem with your session."
          }
          variant={signedOut ? "info" : "error"}
          actionHref={signedOut ? "/auth" : undefined}
          actionLabel={signedOut ? "Go to auth →" : undefined}
        />
      </div>
    );
  }

  const detail = await loadDocumentDetail(auth.user.id, id);

  if (!detail.ok) {
    const notFound = detail.kind === "not_found";
    return (
      <div className="space-y-6">
        <BackLink />
        <NoticeCard
          title={notFound ? "Document not found" : "Could not load document"}
          description={
            notFound
              ? "This document does not exist, or it belongs to another account."
              : "The database could not be reached. This is a server-side problem — please try again shortly."
          }
          variant="error"
        />
      </div>
    );
  }

  const { doc, chunks, chunkTotal } = detail;

  return (
    <div className="space-y-6">
      {/* Back */}
      <div>
        <Link
          href="/documents"
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--brand-2)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-2)]/30 focus-visible:ring-offset-2 rounded"
        >
          ← Back to documents
        </Link>
      </div>

      {/* Header card */}
      <Card className="p-0 overflow-hidden">
        <div className="border-b border-[var(--border)] bg-white px-6 py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold tracking-tight text-[var(--text)]">
                  {doc.title}
                </h1>
                <Badge status={doc.status} />
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-white px-2 py-0.5">
                  Created{" "}
                  {new Date(doc.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "2-digit",
                  })}
                </span>
                <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-white px-2 py-0.5">
                  Updated{" "}
                  {new Date(doc.updatedAt ?? doc.createdAt).toLocaleDateString(
                    undefined,
                    { year: "numeric", month: "short", day: "2-digit" },
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link href="/ask" className="hidden sm:inline-flex">
                <Button variant="secondary">Ask</Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 space-y-4">
          {/* Storage path (if present) */}
          {doc.storagePath ? (
            <div className="rounded-xl border border-[var(--border)] bg-white p-4">
              <div className="text-xs font-semibold text-slate-700">
                Storage path
              </div>
              <div className="mt-1 break-all rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                {doc.storagePath}
              </div>
            </div>
          ) : null}

          {/* Primary action */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-[var(--muted)] leading-6">
              {doc.status === "PROCESSED"
                ? "This document is processed and ready for search."
                : "Process this document to extract text and generate embeddings."}
            </div>

            <div className="flex items-center gap-2">
              <ProcessButton documentId={doc.id} />
              <DeleteDocButton documentId={doc.id} />
              <Link href="/ask" className="sm:hidden">
                <Button variant="secondary">Ask</Button>
              </Link>
            </div>
          </div>

          {/* Metadata (collapsible, nicer) */}
          <details className="rounded-xl border border-[var(--border)] bg-white p-4">
            <summary className="cursor-pointer text-sm font-semibold list-none">
              <span className="inline-flex items-center gap-2">
                Metadata (debug)
                <span className="text-xs font-medium text-[var(--muted)]">
                  JSON
                </span>
              </span>
            </summary>
            <pre className="mt-3 overflow-auto rounded-lg bg-slate-50 p-3 text-xs">
              {JSON.stringify(doc.metadata ?? {}, null, 2)}
            </pre>
          </details>
        </div>
      </Card>

      {/* Chunks */}
      <Card className="p-0 overflow-hidden">
        <div className="border-b border-[var(--border)] bg-white px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">
                Chunks <span className="text-[var(--muted)]">({chunkTotal})</span>
              </div>
              <div className="text-xs text-[var(--muted)]">
                These are the searchable pieces used for retrieval.
                {chunkTotal > chunks.length
                  ? ` Showing the first ${chunks.length} of ${chunkTotal}.`
                  : ""}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          {chunkTotal === 0 ? (
            <div className="text-sm text-[var(--muted)]">
              No chunks found. If the document is not processed yet, click Process
              above.
            </div>
          ) : (
            <ul className="space-y-3">
              {chunks.map((c) => (
                <li
                  key={c.id}
                  className="rounded-xl border border-[var(--border)] bg-white p-4 transition-shadow duration-150 hover:shadow-sm"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2">
                      <div className="text-xs font-semibold text-slate-700">
                        Chunk #{c.chunkIndex}
                      </div>
                      {typeof c.tokenCount === "number" ? (
                        <span className="rounded-full border border-[var(--border)] bg-slate-50 px-2 py-0.5 text-xs text-[var(--muted)]">
                          ~{c.tokenCount} tokens
                        </span>
                      ) : (
                        <span className="rounded-full border border-[var(--border)] bg-slate-50 px-2 py-0.5 text-xs text-[var(--muted)]">
                          tokens: n/a
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3 text-sm whitespace-pre-wrap leading-6">
                    {c.textChunk}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}