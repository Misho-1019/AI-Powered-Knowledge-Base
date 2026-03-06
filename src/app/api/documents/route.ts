import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => null)
        const title = body?.title;
        const storagePath = body?.storagePath;
        const originalFilename = body?.originalFilename;

        if (!title || typeof title !== 'string') {
            return NextResponse.json({ error: "Missing or invalid title" }, { status: 400 })
        }

        if (!storagePath || typeof storagePath !== 'string') {
            return NextResponse.json({ error: "Missing or invalid storagePath" }, { status: 400 })
        }

        const supabase = await createSupabaseServerClient();

        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

        const { data, error } = await supabase
          .from('documents')
          .insert({
            user_id: user.id,
            title,
            storage_path: storagePath,
            status: 'PENDING',
            metadata: {
                source: 'upload',
                originalFilename: typeof originalFilename === 'string' ? originalFilename : null,
            }
          })
          .select('id')
          .single();

        if (error) {
            console.error('create document error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ ok: true, documentId: data.id })
    } catch (err: any) {
        console.error('documents POST error:', err);
        return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
    }
}