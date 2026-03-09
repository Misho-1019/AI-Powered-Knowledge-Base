import ProcessDocButton from "@/components/ProcessDocButton";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import NoticeCard from "@/components/ui/NoticeCard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DocumentsPage() {
    const supabase = await createSupabaseServerClient();

    const { data: userData } = await supabase.auth.getUser();

    const user = userData.user;

    if (!user) {
        return (
            <div className="space-y-6">
                <NoticeCard
                    title="Not signed in"
                    description="You need an account to view and manage documents."
                    actionHref="/auth"
                    actionLabel="Go to auth →"
                />
            </div>
        )
    }

    const { data: documents, error } = await supabase.from('documents').select('id, title, status, created_at').order('created_at', { ascending: false })

    if (error) {
      return (
        <div className="space-y-6">
          <NoticeCard
            title="Could not load documents"
            description={error.message}
            variant="error"
          />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold">Documents</h1>
            <p className="text-sm text-[var(--muted)]">
              Manage your knowledge sources and processing status.
            </p>
          </div>
    
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/documents/new" className="inline-block">
              <Button variant="secondary" className="w-full sm:w-auto">
                + New Note
              </Button>
            </Link>
          
            <Link href="/documents/upload" className="inline-block">
              <Button variant="primary" className="w-full sm:w-auto">
                Upload File
              </Button>
            </Link>
          </div>
        </div>
    
        {/* List Card */}
        <Card className="p-0 overflow-hidden">
          <div className="border-b border-[var(--border)] px-6 py-4 bg-white">
            <div className="text-sm font-semibold">Your documents</div>
            <div className="text-xs text-[var(--muted)]">
              Click a document to view details and chunks.
            </div>
          </div>
    
          {!documents || documents.length === 0 ? (
            <EmptyState
              title="No documents yet"
              subtitle="Upload a file or create a note to start building your knowledge base."
              ctaLabel="Upload document"
              ctaHref="/documents/upload"
              icon={<span className="text-lg">📄</span>}
            />
          ) : (
            <div className="divide-y divide-[var(--border)] animate-[fadeUp_0.25s_ease-out]">
              {documents.map((doc) => (
                <Link
                  key={doc.id}
                  href={`/documents/${doc.id}`}
                  className="group block px-6 py-4 rounded-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-sm hover:bg-gradient-to-r hover:from-slate-50 hover:to-white hover:border-slate-200 motion-safe:transform-gpu focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-2)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="truncate text-[15px] font-semibold text-[var(--text)]">{doc.title}</span>
              
                        <Badge status={doc.status} />
              
                        {doc.status === "PROCESSING" && (
                          <span className="ml-2 inline-flex items-center gap-2 text-xs text-[var(--muted)]">
                            <svg
                              className="h-3.5 w-3.5 animate-spin"
                              viewBox="0 0 24 24"
                              fill="none"
                              aria-hidden="true"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                              />
                            </svg>
                            <span>Processing…</span>
                          </span>
                        )}
                      </div>
              
                      <div className="mt-1 text-xs text-[var(--muted)]">
                        Created:{" "}
                        {new Date(doc.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "2-digit",
                        })}
                      </div>
                    </div>
              
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Render ProcessDocButton directly, no wrapper with onClick */}
                      {doc.status !== "PROCESSED" && (
                        <ProcessDocButton documentId={doc.id} />
                      )}
              
                      <span className="text-sm font-medium text-[var(--brand-2)] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                        Open →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
}