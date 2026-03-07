import { TypedSupabaseClient } from "@/types/supabase";
import { embedText } from "../ai/embeddings";
import { chatComplete } from "../ai/llm";
import { Database } from "@/types/database";

type MatchChunksReturn = Database['public']['Functions']['match_chunks']['Returns']

export type RagMatch = MatchChunksReturn[number]

export type RagResult =
    | {
        ok: true;
        answer: string;
        sources: RagMatch[];
        model?: string;
        note?: string;
    }
    | {
        ok: false;
        error: string;
    };

function buildContext(matches: RagMatch[]) {
    const maxChunks = Math.min(matches.length, 6)

    const parts: string[] = [];

    for (let i = 0; i < maxChunks; i++) {
        const m = matches[i];
        const sim = Number(m.similarity ?? 0)

        parts.push(
            `SOURCE [[doc:${m.document_id}#chunk:${m.chunk_index}]] (similarity: ${sim.toFixed(
                3
            )})\n${m.text_chunk}\n`
        )
    }

    return parts.join("\n---\n");
}

export async function runRag(params: {
    supabase: TypedSupabaseClient,
    userId: string;
    query: string;
    k?: number;
    minSimilarity?: number;
    documentId?: string;
}): Promise<RagResult> {
    const { supabase, userId, query } = params;
    const k = typeof params?.k === 'number' ? params.k : 5;
    const minSimilarity = typeof params.minSimilarity === 'number' ? params.minSimilarity : 0.35;

    const queryEmbedding = await embedText(query);

    const { data: matchesRaw, error: matchErr } = await supabase.rpc('match_chunks', {
        query_embedding: queryEmbedding,
        match_count: k,
        user_id_input: userId,
        document_id_input: params.documentId ?? null,
    })

    if (matchErr) return { ok: false, error: matchErr.message };

    const matches: RagMatch[] = Array.isArray(matchesRaw) ? matchesRaw : [];

    if (matches.length === 0) {
        return {
            ok: true,
            answer: "I couldn’t find anything relevant in your documents for that question.",
            sources: [],
            note: "No matches returned from vector search.",
        };
    }

    const topSimilarity = Number(matches[0]?.similarity ?? 0);

    if (!Number.isFinite(topSimilarity) || topSimilarity < minSimilarity) {
        return {
            ok: true,
            answer:
                "I couldn’t find enough evidence in your documents to answer that confidently. " +
                "Try rephrasing your question or add more notes about that topic.",
            sources: matches.slice(0, 3),
            note: `Top similarity (${topSimilarity.toFixed(3)}) below threshold (${minSimilarity}).`,
        }
    }

    const context = buildContext(matches);

    const system = [
        "You are a private knowledge base assistant.",
        "Answer using ONLY the provided SOURCE text.",
        "If the answer is not contained in the sources, say you don't know.",
        "Cite sources inline like [[doc:...#chunk:...]].",
    ].join(" ");

    const { text: answer, model } = await chatComplete({
        messages: [
            { role: "system", content: system },
            {
                role: "user",
                content:
                    `Question: ${query}\n\n` +
                    `Here are SOURCES from my documents:\n\n${context}\n\n` +
                    `Write a concise answer with citations.`,
            },
        ],
        temperature: 0.1,
        max_tokens: 450,
    });

    return {
        ok: true,
        answer,
        sources: matches,
        model,
    };
}