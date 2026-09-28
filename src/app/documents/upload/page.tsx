"use client";

import { authClient } from "@/lib/auth-client";
import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import NoticeCard from "@/components/ui/NoticeCard";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Stage = "idle" | "uploading" | "processing" | "done" | "error";

const STAGE_LABEL: Record<Stage, string> = {
  idle: "",
  uploading: "Uploading file…",
  processing: "Extracting text and generating embeddings…",
  done: "Indexed and ready.",
  error: "Something went wrong.",
};

export default function UploadDocumentPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [documentId, setDocumentId] = useState("");

  const upload = async () => {
    setMessage("");
    setDocumentId("");
    setStage("idle");

    if (!file) {
      setMessage("Choose a file first.");
      return;
    }

    if (!session?.user) {
      setMessage("You must be signed in to upload.");
      return;
    }

    setUploading(true);
    setStage("uploading");

    try {
      // 1. Ask the server for a presigned PUT. The browser then uploads
      //    straight to R2, so file bytes never pass through the serverless
      //    request-body limit (~4.5 MB on Vercel).
      const presignRes = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });
      const presigned = await presignRes.json();

      if (!presignRes.ok || !presigned.ok) {
        setUploading(false);
        setStage("error");
        setMessage(
          `Could not prepare the upload: ${presigned.error ?? presignRes.status}`,
        );
        return;
      }

      // 2. PUT the bytes to R2. Content-Type is part of the signature, so it
      //    must match the value the server returned.
      const putRes = await fetch(presigned.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": presigned.contentType },
        body: file,
      });

      if (!putRes.ok) {
        setUploading(false);
        setStage("error");
        setMessage(
          `Storage rejected the upload (${putRes.status}). If the browser console shows a CORS error, the bucket is missing its CORS rule.`,
        );
        return;
      }

      // 3. Record the document row.
      const docRes = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: file.name,
          storagePath: presigned.key,
          originalFilename: file.name,
        }),
      });
      const docData = await docRes.json();

      if (!docData.ok) {
        setUploading(false);
        setStage("error");
        setMessage(
          `Uploaded to storage, but the document record failed: ${docData.error ?? "unknown error"}`,
        );
        return;
      }

      setDocumentId(docData.documentId);

      // 4. Process immediately. Previously this was a manual step the user had
      //    to discover, so uploading and then asking returned "nothing found" —
      //    every component worked, but the experience was a dead end.
      setStage("processing");
      setMessage("Extracting text and generating embeddings…");

      const processRes = await fetch(`/api/documents/${docData.documentId}`, {
        method: "POST",
        credentials: "include",
      });
      const processData = await processRes.json().catch(() => ({}));

      setUploading(false);

      if (!processRes.ok) {
        setStage("error");
        setMessage(
          `Uploaded, but processing failed: ${processData.error ?? processRes.status}. You can retry from the document page.`,
        );
        return;
      }

      const count = Number(processData.chunkCount ?? 0);
      setStage("done");
      setMessage(
        `Indexed ${count} chunk${count === 1 ? "" : "s"}. You can ask questions about it now.`,
      );

      // Show the result rather than leaving the user on the upload form.
      router.push(`/documents/${docData.documentId}`);
    } catch (err) {
      setUploading(false);
      setStage("error");
      setMessage(err instanceof Error ? err.message : "Upload failed");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Upload document</h1>
        <p className="text-sm text-[var(--muted)]">
          Upload a file and we handle the rest: it is stored, text is extracted,
          chunked, and embedded automatically so you can ask about it straight
          away.
        </p>
      </div>

      <NoticeCard
        title="Files upload straight to Cloudflare R2"
        description="Your browser sends the file directly to object storage, so nothing passes through the app server — and larger files avoid the serverless request-body limit. Processing starts automatically when the upload finishes."
        actionHref="/documents"
        actionLabel="Go to documents →"
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main upload card */}
        <Card className="p-0 overflow-hidden">
          <div className="border-b border-[var(--border)] bg-white px-6 py-4">
            <div className="text-sm font-semibold">File</div>
            <div className="text-xs text-[var(--muted)]">
              Supported: PDF, Markdown, TXT (max 5MB for this demo).
            </div>
          </div>

          <div className="px-6 py-6 space-y-4">
            {/* Dropzone UI (still uses the same input under the hood) */}
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-white p-6 transition-all duration-200 ease-out hover:bg-slate-50 hover:border-slate-200">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                      <span className="text-lg" aria-hidden="true">
                        ⬆️
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-semibold">
                        Drag & drop your file
                      </div>
                      <div className="text-sm text-[var(--muted)]">
                        Or click to choose a file. We’ll create a document
                        record automatically.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="sm:text-right">
                  <div className="text-xs text-[var(--muted)]">
                    Types:{" "}
                    <span className="font-medium text-[var(--text)]">
                      .pdf, .md, .txt
                    </span>
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    Size:{" "}
                    <span className="font-medium text-[var(--text)]">
                      max 5MB
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <input
                  type="file"
                  accept=".pdf,.md,.txt"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;

                    if (!f) {
                      setFile(null);
                      return;
                    }

                    const MAX_BYTES = 5 * 1024 * 1024;

                    if (f.size > MAX_BYTES) {
                      setMessage(
                        `File too large. Max size is 5MB for this demo.`,
                      );
                      setFile(null);
                      return;
                    }

                    setMessage("");
                    setFile(f);
                  }}
                  className="block w-full text-sm
                    file:mr-4 file:rounded-lg file:border file:border-[var(--border)]
                    file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium
                    hover:file:bg-slate-50
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-2)]/30 focus-visible:ring-offset-2"
                />
              </div>

              <div className="mt-3 text-xs text-[var(--muted)]">
                {file ? (
                  <span>
                    Selected:{" "}
                    <span className="font-medium text-[var(--text)]">
                      {file.name}
                    </span>{" "}
                    ({Math.round(file.size / 1024)} KB)
                  </span>
                ) : (
                  <span>No file selected yet.</span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  onClick={upload}
                  isLoading={uploading}
                  disabled={!file || uploading}
                >
                  Upload &amp; process
                </Button>

                <Link
                  href="/documents"
                  className="text-sm font-medium text-[var(--brand-2)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-2)]/30 focus-visible:ring-offset-2 rounded"
                >
                  Back to documents
                </Link>
              </div>

              <div
                className={`flex items-center gap-2 text-xs ${
                  stage === "error" ? "text-rose-700" : "text-[var(--muted)]"
                }`}
                aria-live="polite"
              >
                {uploading ? (
                  <>
                    <svg
                      className="h-3.5 w-3.5 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>
                    <span>{STAGE_LABEL[stage]}</span>
                  </>
                ) : null}
              </div>
            </div>

            {/* Status message */}
            {message ? (
              <div
                className={`rounded-xl border p-4 text-sm ${
                  stage === "error"
                    ? "border-rose-200 bg-rose-50"
                    : "border-[var(--border)] bg-white"
                }`}
              >
                <div className="font-medium">
                  {stage === "error"
                    ? "Failed"
                    : stage === "done"
                      ? "Ready"
                      : "Status"}
                </div>
                <div className="mt-1 text-[var(--muted)]">{message}</div>
              </div>
            ) : null}

            {/* Once the document exists, send the user somewhere useful. */}
            {documentId ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-white p-4 text-sm">
                <Link
                  href={`/documents/${documentId}`}
                  className="font-medium text-[var(--brand-2)] hover:underline"
                >
                  View document →
                </Link>
                <Link
                  href="/ask"
                  className="font-medium text-[var(--brand-2)] hover:underline"
                >
                  Ask about it →
                </Link>
              </div>
            ) : null}
          </div>
        </Card>

        {/* Right-side guidance */}
        <Card className="space-y-3">
          <div>
            <div className="text-sm font-semibold">What happens next?</div>
            <div className="text-sm text-[var(--muted)]">
              Uploading stores the file and creates a document record.
              Processing extracts text, chunks it, and generates embeddings for
              search.
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-white p-4">
            <div className="text-sm font-semibold">
              What happens automatically
            </div>
            <ol className="mt-2 list-decimal pl-5 text-sm text-[var(--muted)] space-y-1">
              <li>The file uploads straight to storage</li>
              <li>Text is extracted and split into chunks</li>
              <li>Each chunk is embedded for semantic search</li>
              <li>You land on the document, ready to ask</li>
            </ol>
          </div>

          <div className="text-xs text-[var(--muted)]">
            Tip: If a PDF is scanned (images), extraction may fail or be empty.
            Text-based PDFs work best.
          </div>
        </Card>
      </div>
    </div>
  );
}
