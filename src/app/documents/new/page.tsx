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

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">New note</h1>
          <p className="text-sm text-[var(--muted)]">
            Create a text note and ingest it into your knowledge base.
          </p>
        </div>
    
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Form */}
          <Card className="p-0 overflow-hidden">
            <div className="border-b border-[var(--border)] bg-white px-6 py-4">
              <div className="text-sm font-semibold">Content</div>
              <div className="text-xs text-[var(--muted)]">
                Give it a title and paste your text. We’ll chunk and embed it on ingest.
              </div>
            </div>
    
            <div className="px-6 py-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  placeholder="e.g. Lecture notes — Monetary policy"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
    
              <div className="space-y-2">
                <label className="text-sm font-medium">Note</label>
                <Textarea
                  placeholder="Paste or write your note..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={12}
                />
              </div>
    
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  onClick={handleSubmit}
                  isLoading={loading}
                  disabled={loading || !title.trim() || !text.trim()}
                >
                  Create & ingest
                </Button>
    
                <Link
                  href="/documents"
                  className="text-sm font-medium text-[var(--brand-2)] hover:underline"
                >
                  Back to documents
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
    
            <div className="text-xs text-[var(--muted)]">
              After ingesting, go to <span className="font-medium">Ask</span> to test questions.
            </div>
          </Card>
        </div>
      </div>
    );
}