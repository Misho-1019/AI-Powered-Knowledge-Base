"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Link from "next/link";

export default function UploadDocumentPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [storagePath, setStoragePath] = useState("");

  const upload = async () => {
    setMessage("");
    setStoragePath("");

    if (!file) {
      setMessage("Choose a file first.");
      return;
    }

    setUploading(true);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const user = userData.user;

    if (userErr || !user) {
      setUploading(false);
      setMessage("You must be signed in to upload.");
      return;
    }

    const userId = user.id;

    const safeName = file.name.replaceAll(" ", "_");
    const path = `${userId}/${Date.now()}-${safeName}`;

    const { error: uploadErr } = await supabase.storage
      .from("documents")
      .upload(path, file, {
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });

    setUploading(false);

    if (uploadErr) {
      setMessage(`Upload failed: ${uploadErr.message}`);
      return;
    }

    setStoragePath(path);

    const docRes = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        title: file.name,
        storagePath: path,
        originalFilename: file.name,
      }),
    });

    const docData = await docRes.json();

    if (!docData.ok) {
      setMessage(
        `Upload ok but DB record failed: ${docData.error || "unknown error"}`,
      );
      return;
    }

    setMessage(`Upload successful. Document created: ${docData.documentId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Upload document</h1>
        <p className="text-sm text-[var(--muted)]">
          Upload a file to store it in your knowledge base. After upload, process
          it from the Documents page to extract text and generate embeddings.
        </p>
      </div>

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
                      <span className="text-lg" aria-hidden="true">⬆️</span>
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Drag & drop your file</div>
                      <div className="text-sm text-[var(--muted)]">
                        Or click to choose a file. We’ll create a document record automatically.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="sm:text-right">
                  <div className="text-xs text-[var(--muted)]">
                    Types: <span className="font-medium text-[var(--text)]">.pdf, .md, .txt</span>
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    Size: <span className="font-medium text-[var(--text)]">max 5MB</span>
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
                      setMessage(`File too large. Max size is 5MB for this demo.`);
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
                  Upload
                </Button>

                <Link
                  href="/documents"
                  className="text-sm font-medium text-[var(--brand-2)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-2)]/30 focus-visible:ring-offset-2 rounded"
                >
                  Back to documents
                </Link>
              </div>

              <div className="text-xs text-[var(--muted)]">
                {uploading ? "Uploading…" : " "}
              </div>
            </div>

            {/* Status message */}
            {message ? (
              <div className="rounded-xl border border-[var(--border)] bg-white p-4 text-sm">
                <div className="font-medium">Status</div>
                <div className="mt-1 text-[var(--muted)]">{message}</div>
              </div>
            ) : null}

            {/* Storage path (debug-ish, but presented nicely) */}
            {storagePath ? (
              <div className="rounded-xl border border-[var(--border)] bg-white p-4">
                <div className="text-xs font-semibold text-slate-700">
                  Storage path
                </div>
                <div className="mt-2 break-all rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                  {storagePath}
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        {/* Right-side guidance */}
        <Card className="space-y-3">
          <div>
            <div className="text-sm font-semibold">What happens next?</div>
            <div className="text-sm text-[var(--muted)]">
              Uploading stores the file and creates a document record. Processing
              extracts text, chunks it, and generates embeddings for search.
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-white p-4">
            <div className="text-sm font-semibold">Recommended flow</div>
            <ol className="mt-2 list-decimal pl-5 text-sm text-[var(--muted)] space-y-1">
              <li>Upload the file</li>
              <li>Open it from Documents</li>
              <li>Click Process</li>
              <li>Go to Ask and query it</li>
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