import ProcessButton from "@/components/ProcessButton";
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
        <main className="p-6 space-y-4">
          <Link className="underline" href="/documents">
            ← Back
          </Link>
    
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">{doc.title}</h1>
            <p className="text-sm text-slate-600">
              Status: {doc.status} • Created: {new Date(doc.created_at).toLocaleString()}
            </p>
            {doc.storage_path && (
              <p className="text-sm text-slate-600">Storage: {doc.storage_path}</p>
            )}
          </div>

          <ProcessButton documentId={doc.id} />
    
          <details className="border rounded p-3">
            <summary className="cursor-pointer font-medium">Metadata (debug)</summary>
            <pre className="mt-3 bg-slate-100 p-3 rounded text-xs overflow-auto">
              {JSON.stringify(doc.metadata ?? {}, null, 2)}
            </pre>
          </details>
    
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">
              Chunks ({chunks?.length ?? 0})
            </h2>
    
            {(!chunks || chunks.length === 0) ? (
              <p className="text-slate-600">No chunks found.</p>
            ) : (
              <ul className="space-y-3">
                {chunks.map((c) => (
                  <li key={c.id} className="border rounded p-3">
                    <div className="text-sm text-slate-600 mb-2">
                      Chunk #{c.chunk_index}
                      {typeof c.token_count === "number" ? ` • ~${c.token_count} tokens` : ""}
                    </div>
                    <pre className="whitespace-pre-wrap text-sm">{c.text_chunk}</pre>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
    )
}