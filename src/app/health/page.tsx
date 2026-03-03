import { supabase } from "@/lib/supabaseClient";

export default async function HealthPage() {
    const { data, error } = await supabase.auth.getSession();

    return (
        <main className="p-6 space-y-4">
          <h1 className="text-2xl font-semibold">Supabase Health Check</h1>
    
          {error && (
            <p className="text-red-600">Error: {error.message}</p>
          )}
    
          {!error && (
            <pre className="bg-slate-100 p-4 rounded text-sm">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </main>
    )
}