"use client"

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
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

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Auth</h1>
          <p className="text-sm text-[var(--muted)]">
            Sign up or sign in to manage documents and ask questions.
          </p>
        </div>
    
        <Card className="p-0 overflow-hidden">
          <div className="border-b border-[var(--border)] bg-white px-6 py-4">
            <div className="text-sm font-semibold">Account</div>
            <div className="text-xs text-[var(--muted)]">
              Credentials are handled by Supabase Auth.
            </div>
          </div>
    
          <div className="px-6 py-6 space-y-4">
            {/* Inputs */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <input
                className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-2)]/30"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
    
            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <input
                className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-2)]/30"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <p className="text-xs text-[var(--muted)]">
                For demo use, keep it simple — you can always reset later.
              </p>
            </div>
    
            {/* Actions */}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button onClick={signUp} disabled={!email || !password}>
                Sign Up
              </Button>
              <Button onClick={signIn} variant="secondary" disabled={!email || !password}>
                Sign In
              </Button>
              <Button onClick={signOut} variant="ghost">
                Sign Out
              </Button>
            </div>
    
            {/* Message */}
            {message ? (
              <div className="rounded-xl border border-[var(--border)] bg-slate-50 p-3 text-sm">
                <div className="font-medium">Status</div>
                <div className="text-[var(--muted)]">{message}</div>
              </div>
            ) : null}
    
            {/* Current user */}
            <div className="rounded-xl border border-[var(--border)] bg-white p-4">
              <div className="text-xs font-semibold text-slate-700">Current user</div>
              <div className="mt-1 text-sm text-[var(--muted)]">
                {user ? user.email : "none"}
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
}