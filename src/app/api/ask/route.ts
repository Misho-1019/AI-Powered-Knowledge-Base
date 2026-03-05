import { embedText } from "@/lib/ai/embeddings";
import { chatComplete } from "@/lib/ai/llm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function buildContent(matches: any[]) {
    const maxChunks = Math.min(matches.length, 6)

    const lines = [];

    for (let i = 0; i < maxChunks; i++) {
        const m = matches[i];
        
        lines.push(
            `SOURCE [[doc:${m.document_id}#chunk:${m.chunk_index}]] (similarity: ${Number(m.similarity ?? 0).toFixed(3)})\n` +
            `${m.text_chunk}\n`
        )
    }

    return lines.join("\n---\n")
}

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

        const queryEmbedding = await embedText(query);

        const { data: matches, error: matchErr } = await supabase.rpc('match_chunks', {
            query_embedding: queryEmbedding,
            match_count: k,
            user_id_input: user.id,
        })

        if (matchErr) {
            console.error('match_chunks error:', matchErr);
            return NextResponse.json({ error: matchErr.message }, { status: 500 })
        }

        const safeMatches = Array.isArray(matches) ? matches : [];

        if (safeMatches.length === 0) {
            return NextResponse.json({
                ok: true,
                answer: 'I couldn’t find anything relevant in your documents for that question.',
                sources: [],
            })
        }

        const context = buildContent(safeMatches);

        const system = [
            "You are a private knowledge base assistant.",
            "Answer using ONLY the provided SOURCE text.",
            "If the answer is not contained in the sources, say you don't know.",
            "Cite sources inline like [[doc:...#chunk:...]].",
        ].join(' ');

        const { text: answer, model } = await chatComplete({
            messages: [
                { role: 'system', content: system },
                {
                    role: 'user',
                    content:
                        `Question: ${query}\n\n` +
                        `Here are SOURCES from my documents:\n\n${context}\n\n` +
                        `Write a concise answer with citations.`,
                },
            ],
            temperature: 0.1,
            max_tokens: 450,
        })

        return NextResponse.json({
            ok: true,
            answer,
            sources: safeMatches.map((m: any) => ({
                document_id: m.document_id,
                chunk_index: m.chunk_index,
                similarity: m.similarity,
                text_chunk: m.text_chunk,
            })),
            model,
        })
    } catch (err: any) {
        console.error('ask error:', err);
        return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
    }
}