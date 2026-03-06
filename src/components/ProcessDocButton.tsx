"use client";

import { useState } from "react";

export default function ProcessDocButton({ documentId }: { documentId: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const run = async () => {
    setLoading(true);
    setMsg("");

    const res = await fetch(`/api/documents/${documentId}/process`, {
      method: "POST",
      credentials: "include",
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMsg(data.error || "Failed");
      return;
    }

    setMsg(`Done (${data.chunkCount} chunks)`);
    // soft refresh
    window.location.reload();
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={run}
        disabled={loading}
        className="text-sm bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-50"
      >
        {loading ? "Processing..." : "Process"}
      </button>
      {msg && <span className="text-xs text-slate-600">{msg}</span>}
    </div>
  );
}