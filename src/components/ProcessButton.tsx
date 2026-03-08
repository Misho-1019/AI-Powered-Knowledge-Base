"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

export default function ProcessButton({ documentId }: { documentId: string }) {
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

    setMsg(`Processed: ${data.chunkCount} chunks`);
    window.location.reload();
  };

  return (
    <div className="space-y-2">
      <Button onClick={run} isLoading={loading}>
        Process file
      </Button>

      {msg ? (
        <p className={`text-sm ${isError ? "text-rose-700" : "text-[var(--muted)]"}`}>
          {msg}
        </p>
      ) : null}
    </div>
  );
}