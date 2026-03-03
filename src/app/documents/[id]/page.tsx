import Link from "next/link";

export default async function DocumentDetailPage({ params, } : { params: Promise<{ id: string }>}) {
    const { id } = await params;

    return (
        <main className="p-6 space-y-4">
          <Link className="underline" href="/documents">
            ← Back
          </Link>
    
          <h1 className="text-2xl font-semibold">Document</h1>
          <p className="text-slate-600">ID: {id}</p>
    
          <p className="text-slate-600">
            Next step: fetch this document + its chunks from Supabase.
          </p>
        </main>
    )
}