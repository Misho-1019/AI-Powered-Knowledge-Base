"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { authClient } from "@/lib/auth-client";

type Props = {
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
};

/**
 * One-click demo sandbox: mints an isolated throwaway account pre-loaded with
 * the demo corpus, signs straight into it, and lands on Documents.
 *
 * The account is disposable by design — housekeeping reaps it after a day —
 * so there is deliberately no password to remember and no email to verify.
 */
export default function TryDemoButton({
  label = "Try the demo",
  variant = "primary",
  className = "",
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const start = async () => {
    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/demo/sandbox", { method: "POST" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setBusy(false);
        setError(data?.error ?? "Could not start the demo.");
        return;
      }

      const { error: signInError } = await authClient.signIn.email({
        email: data.email,
        password: data.password,
      });

      setBusy(false);

      if (signInError) {
        setError(signInError.message ?? "Could not sign in to the demo.");
        return;
      }

      router.push("/documents");
      router.refresh();
    } catch (err) {
      setBusy(false);
      setError(
        err instanceof Error ? err.message : "Could not start the demo.",
      );
    }
  };

  return (
    <div className={className}>
      <Button variant={variant} onClick={start} isLoading={busy} disabled={busy}>
        {label}
      </Button>
      {error ? (
        <div className="mt-2 text-xs text-rose-700" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}
