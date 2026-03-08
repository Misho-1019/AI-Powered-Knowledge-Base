import ProcessDocButton from "@/components/ProcessDocButton";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
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
            <Link href="/documents/new">
              <span className="inline-block">
                <span className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 transition">
                  + New Note
                </span>
              </span>
            </Link>
    
            <Link href="/documents/upload">
              <span className="inline-block">
                <span className="rounded-lg bg-gradient-to-r from-[var(--brand-1)] via-[var(--brand-2)] to-[var(--brand-3)] px-3 py-2 text-sm font-medium text-white shadow-sm hover:brightness-[1.02] transition">
                  Upload File
                </span>
              </span>
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
            <div className="px-6 py-12 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                <span className="text-lg">📄</span>
              </div>
            
              <div className="text-sm font-semibold">No documents yet</div>
              <div className="mt-1 text-sm text-[var(--muted)]">
                Upload a file or create a note to start building your knowledge base.
              </div>
            
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Link href="/documents/upload">
                  <span className="rounded-lg bg-gradient-to-r from-[var(--brand-1)] via-[var(--brand-2)] to-[var(--brand-3)] px-3 py-2 text-sm font-medium text-white shadow-sm hover:brightness-[1.02] transition">
                    Upload document
                  </span>
                </Link>
                <Link href="/documents/new">
                  <span className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 transition">
                    Create note
                  </span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="px-6 py-4 hover:bg-slate-50 transition"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {/* Left side */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/documents/${doc.id}`}
                          className="truncate text-sm font-semibold hover:underline"
                        >
                          {doc.title}
                        </Link>
                        <Badge status={doc.status} />

                        {doc.status === "PROCESSING" && (
                          <span className="ml-1 inline-flex items-center gap-1 text-xs text-[var(--muted)]">
                            <span className="h-2 w-2 rounded-full bg-blue-400 animate-ping" />
                            processing
                          </span>
                        )}
                      </div>
    
                      <div className="mt-1 text-xs text-[var(--muted)]">
                        Created{" "}
                        {new Date(doc.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "2-digit",
                        })}
                      </div>
                    </div>
    
                    {/* Right side */}
                    <div className="flex flex-wrap items-center gap-2">
                      {doc.status !== "PROCESSED" && (
                        <ProcessDocButton documentId={doc.id} />
                      )}
    
                      <Link
                        href={`/documents/${doc.id}`}
                        className="text-sm font-medium text-[var(--brand-2)] hover:underline"
                      >
                        Open →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
}