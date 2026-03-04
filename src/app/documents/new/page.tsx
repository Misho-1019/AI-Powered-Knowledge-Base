"use client"

import { useRouter } from "next/navigation"
import { useState } from "react";

export default function NewDocumentPage() {
    const router = useRouter();

    const [title, setTitle] = useState('')
    const [text, setText] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async () => {
        setError('')
        setLoading(true);

        const res = await fetch('/api/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ title, text })
        })

        const data = await res.json();

        setLoading(false)

        if (!res.ok) {
            setError(data.error || 'Something went wrong!')
            return;
        }

        router.push('/documents');
        router.refresh();
    }

    return (
        <main className="p-6 space-y-4 max-w-2xl">
          <h1 className="text-2xl font-semibold">New Note</h1>
    
          <input
            className="border p-2 w-full"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
    
          <textarea
            className="border p-2 w-full h-64"
            placeholder="Paste your text here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
    
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save"}
          </button>
    
          {error && <p className="text-red-600">{error}</p>}
        </main>
    )
}