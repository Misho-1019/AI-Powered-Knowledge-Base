"use client"

import { useState } from "react"

export default function QueryTestPage() {
    const [query, setQuery] = useState('')
    const [result, setResult] = useState<any>(null)

    const handleSearch = async () => {
        const res = await fetch('/api/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ query }),
        })

        const data = await res.json();
        setResult(data)
    }

    return (
        <main className="p-6 space-y-4 max-w-xl">
          <h1 className="text-2xl font-semibold">Query Test</h1>
    
          <input
            className="border p-2 w-full"
            placeholder="Ask something..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
    
          <button
            onClick={handleSearch}
            className="bg-blue-600 text-white px-4 py-2"
          >
            Search
          </button>
    
          {result && (
            <pre className="bg-slate-100 p-4 text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </main>
    )
}