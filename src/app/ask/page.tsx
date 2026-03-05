"use client";

import { useState } from "react";

export default function AskPage() {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<string>("");
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const runAsk = async () => {
    setLoading(true);
    setError("");
    setAnswer("");
    setSources([]);

    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ query, k: 5 }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Request failed");
      return;
    }

    setAnswer(data.answer ?? "");
    setSources(data.sources ?? []);
  };

  return (
    <main className="p-6 space-y-4 max-w-3xl">
      <h1 className="text-2xl font-semibold">Ask</h1>

      <div className="space-y-2">
        <input
          className="border p-2 w-full"
          placeholder="Ask something about your documents..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          onClick={runAsk}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 disabled:opacity-50"
        >
          {loading ? "Thinking..." : "Ask"}
        </button>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      {answer && (
        <section className="border rounded p-4 space-y-2">
          <h2 className="font-semibold">Answer</h2>
          <p className="whitespace-pre-wrap">{answer}</p>
        </section>
      )}

      {sources.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Sources</h2>
          <ul className="space-y-3">
            {sources.map((s, idx) => (
              <li key={idx} className="border rounded p-3">
                <div className="text-sm text-slate-600">
                  [[doc:{s.document_id}#chunk:{s.chunk_index}]] • similarity:{" "}
                  {typeof s.similarity === "number" ? s.similarity.toFixed(3) : "n/a"}
                </div>
                <pre className="mt-2 whitespace-pre-wrap text-sm">{s.text_chunk}</pre>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}