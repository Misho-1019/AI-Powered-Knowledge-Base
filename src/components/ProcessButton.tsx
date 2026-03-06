"use client";

import { useState } from "react";

export default function ProcessButton({ documentId }: { documentId: string }) {
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

    setMsg(`Processed: ${data.chunkCount} chunks`);
    window.location.reload();
  };

  return (
    <div className="space-y-2">
      <button
        onClick={run}
        disabled={loading}
        className="bg-blue-600 text-white px-3 py-1 disabled:opacity-50"
      >
        {loading ? "Processing..." : "Process file"}
      </button>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}