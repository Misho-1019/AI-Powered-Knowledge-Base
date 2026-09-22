"use client";

import Button from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteDocButton({ documentId }: { documentId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const router = useRouter();

  const remove = async () => {
    setBusy(true);
    setMsg("");

    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setBusy(false);
        setMsg(data.error || `Failed (${res.status})`);
        return;
      }

      router.push("/documents");
      router.refresh();
    } catch (err) {
      setBusy(false);
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  };

  if (!confirming) {
    return (
      <Button
        variant="ghost"
        onClick={() => setConfirming(true)}
        className="h-9 px-3 py-2"
      >
        Delete
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-rose-700">
        Delete permanently?
      </span>
      <Button
        variant="ghost"
        onClick={remove}
        isLoading={busy}
        disabled={busy}
        className="h-9 px-3 py-2"
      >
        Yes, delete
      </Button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-xs font-medium text-[var(--muted)] hover:text-[var(--text)]"
      >
        Cancel
      </button>
      {msg ? <span className="text-xs text-rose-700">{msg}</span> : null}
    </div>
  );
}
