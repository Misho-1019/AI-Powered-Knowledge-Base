import { embedText } from "@/lib/ai/embeddings";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function chunkText(text: string, chunkSize = 1500, overlap = 300) {
    const clean = (text ?? '').trim();
    if (!clean) return [];

    const size = Math.max(200, Math.floor(chunkSize));
    const ov = Math.max(0, Math.floor(overlap))
    const safeOverlap = Math.min(ov, size - 1);

    const chunks: string[] = [];
    let start = 0;
    const MAX_CHUNKS = 2000;

    while (start < clean.length && chunks.length < MAX_CHUNKS) {
        const end = Math.min(start + size, clean.length)
        const piece = clean.slice(start, end).trim();
        if (piece) chunks.push(piece);

        if (end === clean.length) break;

        const nextStart = end - safeOverlap;

        start = nextStart <= start ? end : nextStart;
    }

    if (chunks.length >= MAX_CHUNKS) {
        throw new Error("Document too large for MVP processing (exceeded MAX_CHUNKS).")
    }

    return chunks;
}

function getExt(path: string) {
    const lower = path.toLowerCase();
    const idx = lower.lastIndexOf('.');
    
    return idx >= 0 ? lower.slice(idx + 1) : '';
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const supabase = await createSupabaseServerClient();

        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

        const { data: doc, error: docErr } = await supabase
            .from('documents')
            .select('id, title, storage_path, status')
            .eq('id', id)
            .single();
        
        if (docErr || !doc) {
            return NextResponse.json({ error: "Document not found" }, { status: 404 })
        }

        if (!doc.storage_path) {
            return NextResponse.json({ error: "Document has no storage_path to process" }, { status: 400 })
        }

        await supabase.from('documents').update({ status: 'PROCESSING'}).eq('id', id);

        const { data: fileData, error: dlErr } = await supabase.storage.from('documents').download(doc.storage_path);

        if (dlErr || !fileData) {
            await supabase.from('documents').update({ status: 'PENDING'}).eq('id', id);
            return NextResponse.json({ error: dlErr?.message ?? 'Download failed' }, { status: 500 })
        }

        const arrayBuffer = await fileData.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const ext = getExt(doc.storage_path);
        let text = '';

        if (ext === "pdf") {
            const tmpPath = join(tmpdir(), `${randomUUID()}.pdf`);
            await writeFile(tmpPath, buffer);
          
            try {
              const { stdout } = await execFileAsync(
                process.execPath,
                [join(process.cwd(), "scripts", "extract-pdf-text.mjs"), tmpPath],
                { maxBuffer: 10 * 1024 * 1024 } // 10MB stdout buffer
              );
          
              text = (stdout ?? "").toString();
            } finally {
              await unlink(tmpPath).catch(() => {});
            }
        } else if (ext === 'txt' || ext === 'md') {
            text = buffer.toString('utf-8');
        } else {
            await supabase.from('documents').update({ status: 'PENDING'}).eq('id', id);
            return NextResponse.json({ error: `Unsupported file type: .${ext}`}, { status: 400 })
        }

        text = text.trim();

        if (!text) {
            await supabase.from('documents').update({ status: 'PENDING'}).eq('id', id);
            return NextResponse.json({ error: `No text could be extracted from this file`}, { status: 400 })
        }

        await supabase.from('document_chunks').delete().eq('document_id', id);

        const chunks = chunkText(text, 1500, 300);

        const rows = [];

        for (let i = 0; i < chunks.length; i++) {
            const c = chunks[i];
            const embedding = await embedText(c);

            rows.push({
                document_id: id,
                user_id: user.id,
                chunk_index: i,
                text_chunk: c,
                embedding,
                token_count: Math.max(1, Math.ceil(c.length / 4))
            })
        }

        const { error: insErr } = await supabase.from('document_chunks').insert(rows);

        if (insErr) {
            await supabase.from("documents").update({ status: "PENDING" }).eq("id", id);
            return NextResponse.json({ error: insErr.message }, { status: 500 });
        }

        await supabase.from('documents').update({ status: 'PROCESSED'}).eq('id', id);

        return NextResponse.json({ ok: true, documentId: id, chunkCount: chunks.length })
    } catch (err: any) {
        console.error('process error:', err);
        return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
    }
}