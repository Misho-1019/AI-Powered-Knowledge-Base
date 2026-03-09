"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

export default function ProcessDocButton({ documentId }: { documentId: string }) {
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

      setMsg(`Done (${data.chunkCount} chunks)`);

      // refresh server-rendered documents list without full page reload
      router.refresh();
    } catch (err: any) {
      setLoading(false);
      setIsError(true);
      setMsg(err?.message || "Failed");
    }
  };

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
        disabled={loading}
        className="h-9 px-3 py-2"
      >
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