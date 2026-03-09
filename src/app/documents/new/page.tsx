"use client"

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import NoticeCard from "@/components/ui/NoticeCard";
import Textarea from "@/components/ui/Textarea";
import Link from "next/link";
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

  const canSubmit = !loading && !!title.trim() && !!text.trim();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">New note</h1>
          <p className="text-sm text-[var(--muted)]">
            Create a text note and ingest it into your knowledge base.
          </p>
        </div>

        {/* Quick nav */}
        <Link
          href="/documents"
          className="inline-flex items-center text-sm font-medium text-[var(--brand-2)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-2)]/30 focus-visible:ring-offset-2 rounded"
        >
          ← Back to documents
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Form */}
        <Card className="p-0 overflow-hidden">
          {/* Card header */}
          <div className="border-b border-[var(--border)] bg-white px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">Write</div>
                <div className="text-xs text-[var(--muted)]">
                  Give it a title and paste your text. We’ll chunk and embed it on ingest.
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-2">
                <span className="rounded-full border border-[var(--border)] bg-white px-2.5 py-1 text-xs text-[var(--muted)]">
                  Markdown-friendly
                </span>
              </div>
            </div>
          </div>

          <div className="px-6 py-6 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                placeholder="e.g. Lecture notes — Monetary policy"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <p className="text-xs text-[var(--muted)]">
                Keep it descriptive — you’ll search and reference this later.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-medium">Note</label>
                <div className="text-xs text-[var(--muted)]">
                  {text.trim() ? `${text.trim().length.toLocaleString()} chars` : " "}
                </div>
              </div>

              {/* Editor frame */}
              <div className="rounded-xl border border-[var(--border)] bg-white">
                <div className="border-b border-[var(--border)] px-4 py-2 text-xs text-[var(--muted)] flex items-center justify-between">
                  <span>Write or paste content</span>
                  <span className="hidden sm:inline">Tip: headings + bullets work best</span>
                </div>
                <div className="p-3">
                  <Textarea
                    placeholder="Paste or write your note..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={12}
                    className="leading-6"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  onClick={handleSubmit}
                  isLoading={loading}
                  disabled={!canSubmit}
                >
                  Create & ingest
                </Button>

                <span className="text-xs text-[var(--muted)]">
                  {canSubmit ? "Ready to ingest." : "Add a title and some text to continue."}
                </span>
              </div>

              {/* Secondary action */}
              <Link
                href="/ask"
                className="text-sm font-medium text-[var(--brand-2)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-2)]/30 focus-visible:ring-offset-2 rounded"
              >
                Try Ask →
              </Link>
            </div>

            {error ? (
              <NoticeCard title="Could not save note" description={error} variant="error" />
            ) : null}
          </div>
        </Card>

        {/* Guidance */}
        <Card className="space-y-3">
          <div>
            <div className="text-sm font-semibold">Tips</div>
            <div className="text-sm text-[var(--muted)]">
              Notes are ideal for clean, searchable text (no PDF extraction).
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-white p-4">
            <div className="text-sm font-semibold">Best results</div>
            <ul className="mt-2 list-disc pl-5 text-sm text-[var(--muted)] space-y-1">
              <li>Use headings and bullet points</li>
              <li>Keep one topic per note when possible</li>
              <li>Include key terms you’ll ask about later</li>
            </ul>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-slate-50 p-4">
            <div className="text-sm font-semibold">Suggested structure</div>
            <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">
              <li><span className="font-medium text-[var(--text)]">1)</span> Summary</li>
              <li><span className="font-medium text-[var(--text)]">2)</span> Key concepts</li>
              <li><span className="font-medium text-[var(--text)]">3)</span> Examples</li>
              <li><span className="font-medium text-[var(--text)]">4)</span> Questions to ask</li>
            </ul>
          </div>

          <div className="text-xs text-[var(--muted)]">
            After ingesting, go to <span className="font-medium">Ask</span> to test questions.
          </div>
        </Card>
      </div>
    </div>
  );
}