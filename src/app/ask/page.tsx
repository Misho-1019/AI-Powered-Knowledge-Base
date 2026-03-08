"use client";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { useEffect, useState } from "react";

type DocOption = { id: string, title: string, status: string };

export default function AskPage() {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<string>("");
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [docs, setDocs] = useState<DocOption[]>([])
  const [docId, setDocId] = useState<string>('')

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/documents/list', { credentials: 'include' });

      const data = await res.json();
      
      if (res.ok && data?.ok) {
        setDocs(data.documents ?? [])
      }
    })();
  }, [])

  const runAsk = async () => {
    setLoading(true);
    setError("");
    setAnswer("");
    setSources([]);

    const payload: any = { query, k: 5 };
    if (docId) payload.documentId = docId;

    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
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
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Ask</h1>
        <p className="text-sm text-[var(--muted)]">
          Ask questions and get answers grounded in your documents, with sources.
        </p>
      </div>
  
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Left: controls */}
        <Card className="p-0 overflow-hidden">
          <div className="border-b border-[var(--border)] bg-white px-6 py-4">
            <div className="text-sm font-semibold">Query</div>
            <div className="text-xs text-[var(--muted)]">
              Choose scope, write a question, then run retrieval + answer.
            </div>
          </div>
  
          <div className="px-6 py-6 space-y-5">
            {/* Scope */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Search scope</label>
              <select
                className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-2)]/30"
                value={docId}
                onChange={(e) => setDocId(e.target.value)}
              >
                <option value="">All documents</option>
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title} {d.status !== "PROCESSED" ? `(${d.status})` : ""}
                  </option>
                ))}
              </select>
  
              <p className="text-xs text-[var(--muted)]">
                Tip: pick a single processed document to reduce noise.
              </p>
            </div>
  
            {/* Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Your question</label>
              <input
                className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-2)]/30"
                placeholder="Ask something about your documents..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
  
            {/* Actions */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                onClick={runAsk}
                isLoading={loading}
                disabled={loading || !query.trim()}
              >
                Ask
              </Button>
  
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setAnswer("");
                  setSources([]);
                  setError("");
                }}
                className="text-sm font-medium text-[var(--muted)] hover:text-[var(--text)]"
              >
                Clear
              </button>
            </div>
  
            {/* Error */}
            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}
          </div>
        </Card>
  
        {/* Right: output */}
        <div className="space-y-6">
          {/* Answer */}
          <Card className="p-0 overflow-hidden">
            <div className="border-b border-[var(--border)] bg-white px-6 py-4">
              <div className="text-sm font-semibold">Answer</div>
              <div className="text-xs text-[var(--muted)]">
                The model should answer using retrieved sources.
              </div>
            </div>
  
            <div className="px-6 py-6">
              {loading ? (
                <div className="space-y-3">
                  <div className="h-4 w-2/3 rounded bg-slate-100" />
                  <div className="h-4 w-full rounded bg-slate-100" />
                  <div className="h-4 w-5/6 rounded bg-slate-100" />
                  <div className="mt-3 text-xs text-[var(--muted)]">
                    Thinking…
                  </div>
                </div>
              ) : answer ? (
                <p className="whitespace-pre-wrap text-sm leading-6">{answer}</p>
              ) : (
                <div className="text-sm text-[var(--muted)]">
                  Ask a question to see an answer here.
                </div>
              )}
            </div>
          </Card>
  
          {/* Sources */}
          <Card className="p-0 overflow-hidden">
            <div className="border-b border-[var(--border)] bg-white px-6 py-4">
              <div className="text-sm font-semibold">Sources</div>
              <div className="text-xs text-[var(--muted)]">
                Top matches from your knowledge base.
              </div>
            </div>
  
            <div className="px-6 py-6">
              {sources.length > 0 ? (
                <ul className="space-y-3">
                  {sources.map((s, idx) => (
                    <li
                      key={idx}
                      className="rounded-xl border border-[var(--border)] bg-white p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs text-[var(--muted)]">
                          [[doc:{s.document_id}#chunk:{s.chunk_index}]]
                        </div>
                        <div className="text-xs text-[var(--muted)]">
                          similarity:{" "}
                          {typeof s.similarity === "number"
                            ? s.similarity.toFixed(3)
                            : "n/a"}
                        </div>
                      </div>
  
                      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm whitespace-pre-wrap">
                        {s.text_chunk}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-[var(--muted)]">
                  Retrieved chunks will appear here after you ask a question.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}