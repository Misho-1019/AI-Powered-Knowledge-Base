"use client"

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useState } from "react"

/** Where to land after a successful sign-in. */
function destinationAfterAuth() {
  if (typeof window === "undefined") return "/documents";
  const next = new URLSearchParams(window.location.search).get("next");
  // Only allow same-site relative paths.
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/documents";
}

export default function AuthPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const user = session?.user ?? null;

  const signUp = async () => {
    setBusy(true);
    setMessage('');
    const { error } = await authClient.signUp.email({
      email,
      password,
      // Better Auth requires a name; fall back to the email local-part.
      name: name.trim() || email.split('@')[0] || 'New user',
    });
    setBusy(false);

    if (error) {
      setMessage(error.message ?? 'Could not create the account.');
      return;
    }
    setMessage('Account created.');
    router.push(destinationAfterAuth());
    router.refresh();
  }

  const signIn = async () => {
    setBusy(true);
    setMessage('');
    const { error } = await authClient.signIn.email({ email, password });
    setBusy(false);

    if (error) {
      setMessage(error.message ?? 'Could not sign in.');
      return;
    }
    setMessage('Signed in.');
    router.push(destinationAfterAuth());
    router.refresh();
  }

  const signOut = async () => {
    setBusy(true);
    await authClient.signOut();
    setBusy(false);
    setMessage('Signed out.');
    router.refresh();
  }

  const isValid = !!email && !!password;

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-start justify-center">
      <div className="w-full max-w-xl space-y-6">
        {/* Header */}
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Account</h1>
          <p className="text-sm text-[var(--muted)]">
            Sign up or sign in to manage documents and ask questions.
          </p>
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="border-b border-[var(--border)] bg-white px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Auth</div>
                <div className="text-xs text-[var(--muted)]">
                  Email and password, handled by Better Auth.
                </div>
              </div>

              {/* Current user mini pill */}
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs">
                <span className="text-[var(--muted)]">Signed in:</span>
                <span className="font-medium text-[var(--text)]">
                  {isPending ? "…" : user ? user.email : "none"}
                </span>
              </div>
            </div>
          </div>

          <div className="px-6 py-6 space-y-5">
            {/* Inputs */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  placeholder="name@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <p className="text-xs text-[var(--muted)]">
                  Minimum 8 characters.
                </p>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium">
                  Name <span className="text-[var(--muted)]">(new accounts only)</span>
                </label>
                <Input
                  placeholder="Optional — defaults to your email handle"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <Button onClick={signIn} variant="primary" disabled={!isValid || busy}>
                Sign In
              </Button>
              <Button onClick={signUp} variant="secondary" disabled={!isValid || busy}>
                Create account
              </Button>

              <div className="sm:flex-1" />

              <Button onClick={signOut} variant="ghost" disabled={!user || busy}>
                Sign Out
              </Button>
            </div>

            {/* Message */}
            {message ? (
              <div className="rounded-xl border border-[var(--border)] bg-white p-4">
                <div className="text-sm font-medium">Status</div>
                <div className="mt-1 text-sm text-[var(--muted)]">{message}</div>
              </div>
            ) : null}

            {/* Current user (mobile) */}
            <div className="sm:hidden rounded-xl border border-[var(--border)] bg-white p-4">
              <div className="text-xs font-semibold text-slate-700">Signed in</div>
              <div className="mt-1 text-sm text-[var(--muted)]">
                {isPending ? "…" : user ? user.email : "none"}
              </div>
            </div>
          </div>
        </Card>

        {/* Tiny footer hint (UI only) */}
        <div className="text-center text-xs text-[var(--muted)]">
          Tip: Use the same email to sign in after signing up.
        </div>
      </div>
    </div>
  );
}
