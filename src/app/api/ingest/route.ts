import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";


function chunkText(text: string, chunkSize = 1500, overlap = 300) {
    const clean = (text ?? "").trim();
    if (!clean) return [];

    // Safety guards to prevent infinite loops / weird params
    const size = Math.max(200, Math.floor(chunkSize));
    const ov = Math.max(0, Math.floor(overlap));

    // overlap must be smaller than chunk size
    const safeOverlap = Math.min(ov, size - 1);

    const chunks: string[] = [];
    let start = 0;

    // Another guard: hard cap number of chunks to avoid crashes on unexpected input
    const MAX_CHUNKS = 2000;

    while (start < clean.length && chunks.length < MAX_CHUNKS) {
        const end = Math.min(start + size, clean.length);
        const piece = clean.slice(start, end).trim();
        if (piece) chunks.push(piece);

        if (end === clean.length) break; // reached the end

        // Ensure start always moves forward
        const nextStart = end - safeOverlap;
        if (nextStart <= start) {
            start = end; // fallback: no overlap if it would stall
        } else {
            start = nextStart;
        }
    }

    if (chunks.length >= MAX_CHUNKS) {
        throw new Error("Document too large for MVP chunking (exceeded MAX_CHUNKS).");
    }

    return chunks;
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => null)

        if (!body || typeof body !== 'object') {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const { title, text, metadata } = body as {
            title?: string;
            text?: string;
            metadata?: Record<string, any>;
        }

        if (!title || typeof title !== 'string') {
            return NextResponse.json({ error: 'Missing or Invalid title' }, { status: 400 })
        }

        if (!text || typeof text !== 'string') {
            return NextResponse.json({ error: 'Missing or Invalid text' }, { status: 400 })
        }

        const supabase = await createSupabaseServerClient();

        const { data: userData, error: userErr } = await supabase.auth.getUser();

        if (userErr) {
            console.error('auth.getUser error:', userErr);
            return NextResponse.json({ error: 'Unable to get user' }, { status: 500 })
        }

        const user = userData?.user;

        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const user_id = user.id;

        const { data: docData, error: insertDocErr } = await supabase
            .from('documents')
            .insert(
                {
                    user_id,
                    title,
                    content: text.substring(0, 10_000),
                    status: 'PROCESSING',
                    metadata: metadata ?? {},
                },
                { returning: 'representation' }
            )
            .select('id')
            .single();

        if (insertDocErr || !docData?.id) {
            console.error('insert document error', insertDocErr);
            return NextResponse.json({ error: 'Failed to create document' }, { status: 500 })
        }

        const documentId = docData.id as string;

        const chunks = chunkText(text, 1500, 300)

        const chunkRows = chunks.map((c, idx) => ({
            document_id: documentId,
            user_id,
            chunk_index: idx,
            text_chunk: c,
            token_count: Math.max(1, Math.ceil(c.length / 4))
        }))

        const { error: insertChunksErr } = await supabase.from('document_chunks').insert(chunkRows);

        if (insertChunksErr) {
            console.error('insert chunks error:', insertChunksErr);

            await supabase.from('documents').update({ status: 'PENDING' }).eq('id', documentId)
            return NextResponse.json({ error: 'Failed to insert document chunks' }, { status: 500 })
        }

        await supabase.from('documents').update({ status: 'PROCESSED' }).eq('id', documentId)

        return NextResponse.json({
            ok: true,
            documentId,
            chunkCount: chunks.length
        })
    } catch (error) {
        console.error('ingest error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}