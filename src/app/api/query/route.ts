import { embedText } from "@/lib/ai/embeddings";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { query, k = 5 } = body;

        if (!query || typeof query !== 'string') {
            return NextResponse.json(
                { error: "Missing or invalid query" },
                { status: 400 },
            )
        }

        const supabase = await createSupabaseServerClient();

        const { data: userData } = await supabase.auth.getUser();

        const user = userData.user;

        if (!user) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
        }

        const queryEmbedding = await embedText(query);

        const { data, error } = await supabase.rpc('match_chunks', {
            query_embedding: queryEmbedding,
            match_count: k,
            user_id_input: user.id,
        })

        if (error) {
            console.error("Vector search error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({
            ok: true,
            matches: data,
        })
    } catch (err: any) {
        console.error('query error:', err);
        return NextResponse.json(
            { error: err.message || 'Server error' },
            { status: 500 },
        )
    }
}