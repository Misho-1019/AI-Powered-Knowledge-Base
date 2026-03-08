import Card from "@/components/ui/Card";
import NoticeCard from "@/components/ui/NoticeCard";
import { supabase } from "@/lib/supabaseClient";

export default async function HealthPage() {
    const { data, error } = await supabase.auth.getSession();

    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Supabase health</h1>
          <p className="text-sm text-[var(--muted)]">
            Quick check for auth session connectivity.
          </p>
        </div>
    
        {error ? (
          <NoticeCard
            title="Connection error"
            description={error.message}
            variant="error"
          />
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="border-b border-[var(--border)] bg-white px-6 py-4">
              <div className="text-sm font-semibold">Session</div>
              <div className="text-xs text-[var(--muted)]">
                Raw session payload from Supabase.
              </div>
            </div>
    
            <div className="px-6 py-6">
              <pre className="overflow-auto rounded-lg bg-slate-50 p-4 text-xs">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          </Card>
        )}
      </div>
    );
}