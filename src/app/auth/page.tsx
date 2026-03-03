"use client"

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react"

export default function AuthPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [user, setUser] = useState<any>(null);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const getUser = async () => {
            const { data } = await supabase.auth.getUser();
            setUser(data.user)
        }
    }, [])

    const signUp = async () => {
        const { error } = await supabase.auth.signUp({ email, password })

        if(error) setMessage(error.message);
        else setMessage('Signed Up successfully');
    }

    const signIn = async () => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) setMessage(error.message);
        else {
            setMessage('Signed In successfully!')

            const { data } = await supabase.auth.getUser();

            setUser(data.user)
        }
    }

    const signOut = async () => {
        await supabase.auth.signOut()

        setUser(null)

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
    
          {user && (
            <pre className="bg-slate-100 p-4 text-xs">
              {JSON.stringify(user, null, 2)}
            </pre>
          )}
        </main>
    )
}