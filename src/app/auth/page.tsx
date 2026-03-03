"use client"

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
        <main className="p-6 space-y-4 max-w-md">
          <h1 className="text-2xl font-semibold">Auth</h1>
    
          <input
            className="border p-2 w-full"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
    
          <input
            className="border p-2 w-full"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
    
          <div className="flex gap-2">
            <button onClick={signUp} className="bg-blue-600 text-white px-3 py-1">
              Sign Up
            </button>
            <button onClick={signIn} className="bg-green-600 text-white px-3 py-1">
              Sign In
            </button>
            <button onClick={signOut} className="bg-red-600 text-white px-3 py-1">
              Sign Out
            </button>
          </div>
    
          {message && <p className="text-sm">{message}</p>}
    
          <p className="text-sm text-slate-600">
            Current user: {user ? user.email : "none"}
          </p>
        </main>
    )
}