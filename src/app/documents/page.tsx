import ProcessDocButton from "@/components/ProcessDocButton";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DocumentsPage() {
    const supabase = await createSupabaseServerClient();

    const { data: userData } = await supabase.auth.getUser();

    const user = userData.user;

    if (!user) {
        return (
            <main className="p-6 space-y-3">
              <h1 className="text-2xl font-semibold">Documents</h1>
              <p className="text-slate-600">
                You are not signed in. Go to{" "}
                <Link className="underline" href="/auth">
                  /auth
                </Link>{" "}
                to sign in.
              </p>
            </main>
        )
    }

    const { data: documents, error } = await supabase.from('documents').select('id, title, status, created_at').order('created_at', { ascending: false })

    if (error) {
        return (
            <main className="p-6 space-y-3">
              <h1 className="text-2xl font-semibold">Documents</h1>
              <p className="text-red-600">Error: {error.message}</p>
            </main>
        )
    }

    return (
        <Card>
          <h1 className="text-2xl font-semibold">Documents</h1>
    
          <div className="flex gap-4">
            <Link className="underline" href="/documents/new">
              + New Note
            </Link>
            <Link className="underline" href="/documents/upload">
              Upload File
            </Link>
            <Link className="underline" href="/ask">
              Ask
            </Link>
          </div>
    
          {(!documents || documents.length === 0) ? (
            <p className="text-slate-600">No documents yet. Add one via /ingest-test.</p>
          ) : (
            <ul className="space-y-2">
              {documents.map((doc) => (
                <li key={doc.id} className="border rounded p-3">
                  <div className="font-medium">{doc.title}</div>
                  <div className="text-sm text-slate-600">
                    Status: <Badge status={doc.status}/> • Created: {new Date(doc.created_at).toLocaleString()}
                  </div>
                  {doc.status !== 'PROCESSED' && (
                    <div className="mt-2">
                      <ProcessDocButton documentId={doc.id} />
                    </div>
                  )}
                  <Link className="underline text-sm" href={`/documents/${doc.id}`}>
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
    )
}