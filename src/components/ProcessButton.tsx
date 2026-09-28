"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

export default function ProcessButton({
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

  const run = async () => {
    setLoading(true);
    setMsg("");
    setIsError(false);

    try {
      const res = await fetch(`/api/documents/${documentId}`, {
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
      setMsg(`Processed: ${count} chunk${count === 1 ? "" : "s"}`);
      router.refresh();
    } catch (err) {
      setLoading(false);
      setIsError(true);
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  };

  const label = status === "FAILED" ? "Retry processing" : "Process file";

  return (
    <div className="space-y-2">
      <Button
        onClick={run}
        isLoading={loading}
        disabled={loading || status === "PROCESSING"}
      >
        {label}
      </Button>

      {msg ? (
        <p
          className={`text-sm ${isError ? "text-rose-700" : "text-[var(--muted)]"}`}
        >
          {msg}
        </p>
      ) : null}
    </div>
  );
}
