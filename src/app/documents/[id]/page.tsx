import ProcessButton from "@/components/ProcessButton";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DocumentDetailPage({ params, } : { params: Promise<{ id: string }>}) {
    const { id } = await params;

    const supabase = await createSupabaseServerClient();

    const { data: userData } = await supabase.auth.getUser();

    const user = userData.user;

    if (!user) {
        return (
            <main className="p-6 space-y-3">
              <Link className="underline" href="/documents">
                ← Back
              </Link>
              <h1 className="text-2xl font-semibold">Document</h1>
              <p className="text-slate-600">
                You are not signed in. Go to{" "}
                <Link className="underline" href="/auth">
                  /auth
                </Link>
                .
              </p>
            </main>
        )
    }

    const { data: doc, error: docError } = await supabase.from('documents').select('id, title, status, created_at, updated_at, metadata, storage_path').eq('id', id).single();

    if (docError) {
        return (
            <main className="p-6 space-y-3">
              <Link className="underline" href="/documents">
                ← Back
              </Link>
              <h1 className="text-2xl font-semibold">Document</h1>
              <p className="text-red-600">Error: {docError.message}</p>
              <p className="text-slate-600 text-sm">
                (If the ID is valid but you still can’t see it, that’s likely RLS doing its job.)
              </p>
            </main>
        )
    }

    const { data: chunks, error: chunksError } = await supabase.from('document_chunks').select('id, chunk_index, text_chunk, token_count, created_at').eq('document_id', id).order('chunk_index', { ascending: true });

    if (chunksError) {
        return (
            <main className="p-6 space-y-3">
              <Link className="underline" href="/documents">
                ← Back
              </Link>
              <h1 className="text-2xl font-semibold">{doc.title}</h1>
              <p className="text-red-600">Error loading chunks: {chunksError.message}</p>
            </main>
        )
    }

    return (
      <div className="space-y-6">
        {/* Back */}
        <div>
          <Link
            href="/documents"
            className="text-sm font-medium text-[var(--brand-2)] hover:underline"
          >
            ← Back to documents
          </Link>
        </div>
    
        {/* Header card */}
        <Card className="p-0 overflow-hidden">
          <div className="border-b border-[var(--border)] bg-white px-6 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold">{doc.title}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                  <span>
                    Created{" "}
                    {new Date(doc.created_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "2-digit",
                    })}
                  </span>
                  <span>•</span>
                  <span>
                    Updated{" "}
                    {new Date(doc.updated_at ?? doc.created_at).toLocaleDateString(
                      undefined,
                      { year: "numeric", month: "short", day: "2-digit" },
                    )}
                  </span>
                </div>
              </div>
    
              <div className="flex items-center gap-2">
                <Badge status={doc.status} />
                <Link href="/ask" className="hidden sm:inline">
                  <Button variant="secondary">Ask</Button>
                </Link>
              </div>
            </div>
          </div>
    
          <div className="px-6 py-6 space-y-4">
            {/* Storage path (if present) */}
            {doc.storage_path ? (
              <div className="rounded-xl border border-[var(--border)] bg-slate-50 p-4">
                <div className="text-xs font-semibold text-slate-700">
                  Storage path
                </div>
                <div className="mt-1 break-all text-xs text-slate-700">
                  {doc.storage_path}
                </div>
              </div>
            ) : null}
    
            {/* Primary action */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-[var(--muted)]">
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
              <summary className="cursor-pointer text-sm font-semibold">
                Metadata (debug)
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
                  Chunks ({chunks?.length ?? 0})
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
                    className="rounded-xl border border-[var(--border)] bg-white p-4"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-slate-700">
                        Chunk #{c.chunk_index}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {typeof c.token_count === "number"
                          ? `~${c.token_count} tokens`
                          : "tokens: n/a"}
                      </div>
                    </div>
    
                    <div className="rounded-lg bg-slate-50 p-3 text-sm whitespace-pre-wrap">
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