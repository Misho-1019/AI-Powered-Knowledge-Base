"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

export default function ProcessDocButton({
  documentId,
  status,
}: {
  documentId: string;
  /** Drives the label: a failed document is retried, not "processed". */
  status?: "PENDING" | "PROCESSING" | "PROCESSED" | "FAILED";
}) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [isError, setIsError] = useState(false);
  const router = useRouter();

  const run = async (e?: React.MouseEvent) => {
    // critical when inside a clickable row <Link>
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (loading) return;

    setLoading(true);
    setMsg("");
    setIsError(false);

    try {
      const res = await fetch(`/api/documents/${documentId}/process`, {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setIsError(true);
        setMsg(data.error || "Failed");
        return;
      }

      const count = Number(data.chunkCount ?? 0);
      setMsg(`Done (${count} chunk${count === 1 ? "" : "s"})`);

      // refresh server-rendered documents list without full page reload
      router.refresh();
    } catch (err) {
      setLoading(false);
      setIsError(true);
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  };

  const label = status === "FAILED" ? "Retry" : "Process";

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      // extra safety: if the wrapper gets clicked, don't bubble to the row link
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        type="button"
        onClick={run}
        isLoading={loading}
        disabled={loading || status === "PROCESSING"}
        className="h-9 px-3 py-2"
      >
        {label}
      </Button>

      {msg ? (
        <span className={`text-xs ${isError ? "text-rose-700" : "text-[var(--muted)]"}`}>
          {msg}
        </span>
      ) : null}
    </div>
  );
}
