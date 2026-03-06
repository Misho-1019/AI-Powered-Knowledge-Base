"use client"

import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { useMemo, useState } from "react"

export default function UploadDocumentPage() {
    const supabase = useMemo(() => createSupabaseBrowserClient(), [])
    const [file, setFile] = useState<File | null>(null)
    const [message, setMessage] = useState('')
    const [uploading, setUploading] = useState(false)
    const [storagePath, setStoragePath] = useState('')

    const upload = async () => {
        setMessage('');
        setStoragePath('');

        if (!file) {
            setMessage('Choose a file first.')
            return;
        }

        setUploading(true);

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        const user = userData.user;

        if (userErr || !user) {
            setUploading(false);
            setMessage('You must be signed in to upload.')
            return;
        }

        const userId = user.id;

        const safeName = file.name.replaceAll(' ', '_');
        const path = `${userId}/${Date.now()}-${safeName}`;

        const { error: uploadErr } = await supabase.storage.from('documents').upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream'});

        setUploading(false)

        if (uploadErr) {
            setMessage(`Upload failed: ${uploadErr.message}`)
            return
        }

        setStoragePath(path)
        setMessage('Upload successful!')
    }

    return (
        <main className="p-6 space-y-4 max-w-xl">
          <h1 className="text-2xl font-semibold">Upload Document</h1>
    
          <input
            type="file"
            accept=".pdf,.md,.txt"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
    
          <button
            onClick={upload}
            disabled={uploading}
            className="bg-blue-600 text-white px-4 py-2 disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
    
          {message && <p className="text-sm">{message}</p>}
    
          {storagePath && (
            <pre className="bg-slate-100 p-3 rounded text-xs overflow-auto">
              storagePath: {storagePath}
            </pre>
          )}
        </main>
    )
}