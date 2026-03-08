"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

export default function ProcessDocButton({ documentId }: { documentId: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [isError, setIsError] = useState(false);

  const run = async () => {
    setLoading(true);
    setMsg("");
    setIsError(false);

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

    setMsg(`Done (${data.chunkCount} chunks)`);
    window.location.reload();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={run} isLoading={loading} className="h-9 px-3 py-2">
        Process
      </Button>

      {msg ? (
        <span className={`text-xs ${isError ? "text-rose-700" : "text-[var(--muted)]"}`}>
          {msg}
        </span>
      ) : null}
    </div>
  );
}