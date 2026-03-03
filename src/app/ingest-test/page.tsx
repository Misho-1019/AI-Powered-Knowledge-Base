"use client";

import { useState } from "react";

export default function IngestTestPage() {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    setResponse(null);

    const res = await fetch("/api/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // important for cookies
      body: JSON.stringify({ title, text }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Something went wrong");
    } else {
      setResponse(data);
    }
  };

  return (
    <main className="p-6 space-y-4 max-w-xl">
      <h1 className="text-2xl font-semibold">Ingest Test</h1>

      <input
        className="border p-2 w-full"
        placeholder="Document title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <textarea
        className="border p-2 w-full h-40"
        placeholder="Paste your text here..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <button
        onClick={handleSubmit}
        className="bg-blue-600 text-white px-4 py-2"
      >
        Submit
      </button>

      {error && <p className="text-red-600">{error}</p>}

      {response && (
        <pre className="bg-slate-100 p-4 text-sm">
          {JSON.stringify(response, null, 2)}
        </pre>
      )}
    </main>
  );
}