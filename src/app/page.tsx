import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export default function HomePage() {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card className="p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              AI Knowledge Base
            </h1>
            <p className="max-w-xl text-sm text-[var(--muted)]">
              Upload files or write notes, process them into searchable chunks,
              then ask questions and get answers with sources.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/documents/upload">
              <Button>Upload document</Button>
            </Link>
            <Link href="/documents/new">
              <Button variant="secondary">Create note</Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Quick actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <QuickAction
          title="Documents"
          description="Manage your uploads and processing status."
          href="/documents"
          cta="Open documents"
        />
        <QuickAction
          title="Ask"
          description="Query your knowledge base and view sources."
          href="/ask"
          cta="Ask a question"
        />
        <QuickAction
          title="Auth"
          description="Sign in/out and manage your session."
          href="/auth"
          cta="Open auth"
        />
      </div>

      {/* How it works */}
      <Card>
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold">How it works</h2>
            <p className="text-sm text-[var(--muted)]">
              A simple pipeline that keeps answers grounded in your own data.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Step
              n="1"
              title="Add knowledge"
              text="Upload PDFs or create notes. Each document becomes a record."
            />
            <Step
              n="2"
              title="Process"
              text="We extract text, chunk it, generate embeddings, and store chunks."
            />
            <Step
              n="3"
              title="Ask with sources"
              text="We search top-matching chunks and answer using only those sources."
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

function QuickAction({
  title,
  description,
  href,
  cta,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <Card className="p-5">
      <div className="space-y-3">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-sm text-[var(--muted)]">{description}</div>
        </div>
        <Link href={href}>
          <Button variant="ghost">{cta} →</Button>
        </Link>
      </div>
    </Card>
  );
}

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4">
      <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold text-white"
           style={{
             background:
               "linear-gradient(90deg, var(--brand-1), var(--brand-2), var(--brand-3))",
           }}
      >
        {n}
      </div>
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-sm text-[var(--muted)]">{text}</div>
    </div>
  );
}