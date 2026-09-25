"use client";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import NoticeCard from "@/components/ui/NoticeCard";
import Select from "@/components/ui/Select";
import Skeleton from "@/components/ui/Skeleton";
import Link from "next/link";
import { useEffect, useState } from "react";

type DocOption = { id: string; title: string; status: string };

type Source = {
  id: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  textChunk: string;
  similarity: number;
  lexicalRank: number | null;
};

/**
 * Replaces `[1]` markers with links to the document they came from.
 *
 * The model used to emit `[[doc:<uuid>#chunk:0]]` straight into the prose, which
 * reads as unfinished output. Numbers map onto the ordered sources list the API
 * returns; anything out of range is left as plain text rather than breaking.
 */
function renderAnswer(answer: string, sources: Source[]) {
  return answer.split(/(\[\d+\])/g).map((part, index) => {
    const match = /^\[(\d+)\]$/.exec(part);
    if (!match) return <span key={index}>{part}</span>;

    const position = Number(match[1]);
    const source = sources[position - 1];

    if (!source) return <span key={index}>{part}</span>;

    return (
      <Link
        key={index}
        href={`/documents/${source.documentId}`}
        title={source.documentTitle}
        className="mx-0.5 inline-flex items-center rounded border border-[var(--border)] bg-slate-50 px-1.5 py-0.5 align-baseline text-xs font-medium text-[var(--brand-2)] no-underline hover:bg-slate-100"
      >
        {position}
      </Link>
    );
  });
}

export default function AskPage() {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [degraded, setDegraded] = useState(false);
  const [note, setNote] = useState("");

  const [docs, setDocs] = useState<DocOption[]>([]);
  const [docId, setDocId] = useState<string>("");

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/documents/list", { credentials: "include" });
      const data = await res.json();

      if (res.ok && data?.ok) {
        setDocs(data.documents ?? []);
      }
    })();
  }, []);

  const runAsk = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError("");
    setAnswer("");
    setSources([]);
    setDegraded(false);
    setNote("");

    const payload: {
      query: string;
      k: number;
      stream: boolean;
      documentId?: string;
    } = { query, k: 5, stream: true };
    if (docId) payload.documentId = docId;

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLoading(false);
        setError(data.error || `Request failed (${res.status})`);
        return;
      }

      if (!res.body) {
        setLoading(false);
        setError("Streaming is not supported in this browser.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line.
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith("data:")) continue;

          let event: {
            type?: string;
            sources?: Source[];
            text?: string;
            note?: string;
            degraded?: boolean;
          };
          try {
            event = JSON.parse(line.slice(5).trim());
          } catch {
            continue; // partial or keepalive frame
          }

          if (event.type === "sources") {
            setSources(event.sources ?? []);
          } else if (event.type === "token" && event.text) {
            accumulated += event.text;
            setAnswer(accumulated);
            // First token: swap the skeleton for the live answer.
            setLoading(false);
          } else if (event.type === "done") {
            setDegraded(Boolean(event.degraded));
            setNote(event.note ?? "");
            setLoading(false);
          }
        }
      }

      setLoading(false);
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Request failed");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading && query.trim()) runAsk();
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      const el = document.getElementById("ask-input") as HTMLTextAreaElement | null;
      if (el) el.focus();
    }, 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="space-y-6">
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
            <div className="space-y-2">
              <label className="text-sm font-medium">Search scope</label>
              <Select value={docId} onChange={(e) => setDocId(e.target.value)}>
                <option value="">All documents</option>
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title} {d.status !== "PROCESSED" ? `(${d.status})` : ""}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-[var(--muted)]">
                Tip: pick a single processed document to reduce noise.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Your question</label>
              <textarea
                id="ask-input"
                placeholder="Ask something about your documents... (Shift+Enter for newline, Enter to submit)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                aria-label="Ask a question"
                rows={4}
                className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm
                  transition-shadow duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-2)]/30"
                disabled={loading}
              />
              <p className="text-xs text-[var(--muted)]">
                Press Enter to submit — Shift+Enter adds a new line.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button onClick={runAsk} isLoading={loading} disabled={loading || !query.trim()}>
                Ask
              </Button>

              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setAnswer("");
                  setSources([]);
                  setError("");
                  setDegraded(false);
                  setNote("");
                }}
                className="text-sm font-medium text-[var(--muted)] hover:text-[var(--text)]"
              >
                Clear
              </button>
            </div>

            {error ? (
              <NoticeCard title="Request failed" description={error} variant="error" />
            ) : null}
          </div>
        </Card>

        {/* Right: output */}
        <div className="space-y-6">
          <Card className="p-0 overflow-hidden">
            <div className="border-b border-[var(--border)] bg-white px-6 py-4">
              <div className="text-sm font-semibold">Answer</div>
              <div className="text-xs text-[var(--muted)]">
                Grounded in the retrieved sources. Numbers link to documents.
              </div>
            </div>

            {answer ? (
              <div className="flex items-center gap-2 px-6 pt-4">
                <Button
                  variant="secondary"
                  className="text-xs px-3 py-1"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(answer);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch {
                      // clipboard unavailable — nothing to do
                    }
                  }}
                  aria-label="Copy answer to clipboard"
                >
                  Copy
                </Button>
                <div className="text-xs text-[var(--muted)]" aria-live="polite">
                  {copied ? "Copied!" : null}
                </div>
              </div>
            ) : null}

            <div className="px-6 py-6 space-y-4" aria-busy={loading}>
              {loading ? (
                <div className="space-y-3" role="status" aria-live="polite">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="pt-2 text-xs text-[var(--muted)]">Thinking…</div>
                </div>
              ) : degraded ? (
                <>
                  <NoticeCard
                    title="Answer unavailable"
                    description={
                      note ||
                      "The retrieved sources are intact, but the answer could not be generated."
                    }
                    variant="error"
                  />
                  {sources.length > 0 ? <SourcesPanel sources={sources} /> : null}
                </>
              ) : answer ? (
                <>
                  <p className="whitespace-pre-wrap text-sm leading-6 animate-[fadeIn_0.25s_ease-out]">
                    {renderAnswer(answer, sources)}
                  </p>
                  {sources.length > 0 ? <SourcesPanel sources={sources} /> : null}
                </>
              ) : (
                <div className="text-sm text-[var(--muted)]">
                  <EmptyState
                    title="Ask a question"
                    subtitle="Type a question on the left and press Ask to retrieve answers from your documents."
                    ctaLabel="Read docs"
                    ctaHref="/documents"
                    icon={<span className="text-lg">❓</span>}
                    className="py-8"
                  />
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SourcesPanel({ sources }: { sources: Source[] }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-slate-50/60 p-4">
      <div className="mb-3 text-xs font-semibold text-slate-700">
        Sources ({sources.length})
      </div>
      <ul className="space-y-3">
        {sources.map((s, index) => (
          <li
            key={s.id}
            className="rounded-lg border border-[var(--border)] bg-white p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 text-[11px] font-semibold text-slate-700">
                  {index + 1}
                </span>
                <Link
                  href={`/documents/${s.documentId}`}
                  className="truncate text-xs font-medium text-[var(--brand-2)] hover:underline"
                >
                  {s.documentTitle}
                </Link>
                <span className="shrink-0 text-xs text-[var(--muted)]">
                  chunk {s.chunkIndex}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                {s.lexicalRank !== null ? (
                  <span
                    className="rounded border border-[var(--border)] bg-slate-50 px-1.5 py-0.5"
                    title="Match type: keyword"
                  >
                    keyword
                  </span>
                ) : (
                  <span
                    className="rounded border border-[var(--border)] bg-slate-50 px-1.5 py-0.5"
                    title="Match type: semantic"
                  >
                    semantic
                  </span>
                )}
                <span>similarity {s.similarity.toFixed(3)}</span>
              </div>
            </div>
            <div className="mt-2 line-clamp-4 rounded bg-slate-50 p-2 text-xs whitespace-pre-wrap leading-5">
              {s.textChunk}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
