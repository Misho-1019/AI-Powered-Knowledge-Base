import { runRag } from "@/lib/services/ragService";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";


export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => null)
        const query = body?.query;
        const k = typeof body?.k === 'number' ? body.k : 5;

        if (!query || typeof query !== 'string') {
            return NextResponse.json({ error: 'Missing or invalid query' }, { status: 400 })
        }

        const supabase = await createSupabaseServerClient();

        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        
        if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

        const result = await runRag({
            supabase,
            userId: user.id,
            query,
            k,
            minSimilarity: 0.35,
        })

        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: 500 })
        }

        return NextResponse.json(result)
    } catch (err: any) {
        console.error('ask error:', err);
        return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
    }
}