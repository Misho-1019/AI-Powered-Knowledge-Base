"use client"

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useEffect, useMemo, useState } from "react"

export default function AuthPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<any>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    });

    return () => sub.subscription.unsubscribe();
  }, [supabase])

  const signUp = async () => {
    const { error } = await supabase.auth.signUp({ email, password })
    setMessage(error ? error.message : 'Signed Up successfully!')
  }

  const signIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setMessage(error ? error.message : 'Signed In successfully!')
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setMessage('Signed Out')
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
                  Credentials are handled by Supabase Auth.
                </div>
              </div>

              {/* Current user mini pill */}
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs">
                <span className="text-[var(--muted)]">Signed in:</span>
                <span className="font-medium text-[var(--text)]">
                  {user ? user.email : "none"}
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
                  For demo use, keep it simple — you can always reset later.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <Button onClick={signIn} variant="primary" disabled={!isValid}>
                Sign In
              </Button>
              <Button onClick={signUp} variant="secondary" disabled={!isValid}>
                Create account
              </Button>

              <div className="sm:flex-1" />

              <Button onClick={signOut} variant="ghost" disabled={!user}>
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
                {user ? user.email : "none"}
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