import ProcessButton from "@/components/ProcessButton";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import NoticeCard from "@/components/ui/NoticeCard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DocumentDetailPage({ params, } : { params: Promise<{ id: string }>}) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();

  const { data: userData } = await supabase.auth.getUser();

  const user = userData.user;

  if (!user) {
    return (
      <div className="space-y-6">
        <Link
          href="/documents"
          className="text-sm font-medium text-[var(--brand-2)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-2)]/30 focus-visible:ring-offset-2 rounded"
        >
          ← Back to documents
        </Link>

        <NoticeCard
          title="Not signed in"
          description="You need an account to view this document."
          actionHref="/auth"
          actionLabel="Go to auth →"
        />
      </div>
    )
  }

  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, title, status, created_at, updated_at, metadata, storage_path')
    .eq('id', id)
    .single();

  if (docError) {
    return (
      <div className="space-y-6">
        <Link
          href="/documents"
          className="text-sm font-medium text-[var(--brand-2)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-2)]/30 focus-visible:ring-offset-2 rounded"
        >
          ← Back to documents
        </Link>

        <NoticeCard
          title="Could not load document"
          description={docError.message}
          variant="error"
        >
          <p className="text-xs text-[var(--muted)]">
            If the ID is valid but you still can’t see it, that’s likely RLS doing
            its job.
          </p>
        </NoticeCard>
      </div>
    );
  }

  const { data: chunks, error: chunksError } = await supabase
    .from('document_chunks')
    .select('id, chunk_index, text_chunk, token_count, created_at')
    .eq('document_id', id)
    .order('chunk_index', { ascending: true });

  if (chunksError) {
    return (
      <div className="space-y-6">
        <Link
          href="/documents"
          className="text-sm font-medium text-[var(--brand-2)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-2)]/30 focus-visible:ring-offset-2 rounded"
        >
          ← Back to documents
        </Link>

        <NoticeCard
          title="Could not load chunks"
          description={chunksError.message}
          variant="error"
        />
      </div>
    );
  }

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
                  {new Date(doc.created_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "2-digit",
                  })}
                </span>
                <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-white px-2 py-0.5">
                  Updated{" "}
                  {new Date(doc.updated_at ?? doc.created_at).toLocaleDateString(
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
          {doc.storage_path ? (
            <div className="rounded-xl border border-[var(--border)] bg-white p-4">
              <div className="text-xs font-semibold text-slate-700">
                Storage path
              </div>
              <div className="mt-1 break-all rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                {doc.storage_path}
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
                Chunks <span className="text-[var(--muted)]">({chunks?.length ?? 0})</span>
              </div>
              <div className="text-xs text-[var(--muted)]">
                These are the searchable pieces used for retrieval.
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          {!chunks || chunks.length === 0 ? (
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
                        Chunk #{c.chunk_index}
                      </div>
                      {typeof c.token_count === "number" ? (
                        <span className="rounded-full border border-[var(--border)] bg-slate-50 px-2 py-0.5 text-xs text-[var(--muted)]">
                          ~{c.token_count} tokens
                        </span>
                      ) : (
                        <span className="rounded-full border border-[var(--border)] bg-slate-50 px-2 py-0.5 text-xs text-[var(--muted)]">
                          tokens: n/a
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3 text-sm whitespace-pre-wrap leading-6">
                    {c.text_chunk}
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