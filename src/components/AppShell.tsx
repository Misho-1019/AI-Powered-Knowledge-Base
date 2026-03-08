/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import Button from "@/components/ui/Button";

function getPageMeta(pathname: string) {
  if (pathname === "/") return { title: "Home", subtitle: "Your knowledge base at a glance." };
  if (pathname === "/documents") return { title: "Documents", subtitle: "Manage uploads and processing status." };
  if (pathname.startsWith("/documents/upload")) return { title: "Upload", subtitle: "Add a new file to your knowledge base." };
  if (pathname.startsWith("/documents/new")) return { title: "New note", subtitle: "Create a text note and ingest it." };
  if (pathname.startsWith("/documents/")) return { title: "Document", subtitle: "Details, metadata, and chunks." };
  if (pathname === "/ask") return { title: "Ask", subtitle: "Ask questions and view grounded sources." };
  if (pathname === "/auth") return { title: "Auth", subtitle: "Sign in to manage your data." };

  return { title: "AI Knowledge Base", subtitle: "Upload, process, then ask questions with sources." };
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { title, subtitle } = getPageMeta(pathname);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [userEmail, setUserEmail] = useState<string>("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? "");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? "");
    });

    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // close sidebar on navigation changes (mobile)
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* Subtle “aurora” accent */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute -top-32 right-[-120px] h-[420px] w-[420px] rounded-full blur-3xl opacity-[0.10]"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, var(--brand-3), transparent 60%), radial-gradient(circle at 70% 70%, var(--brand-1), transparent 55%)",
          }}
        />
      </div>

      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40"
          aria-hidden={!isSidebarOpen}
        >
          {/* backdrop */}
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="absolute inset-0 bg-black/30"
            aria-label="Close menu"
          />

          {/* panel */}
          <aside className="absolute left-0 top-0 bottom-0 w-72 overflow-auto border-r border-[var(--border)] bg-[var(--card)] p-4 shadow-xl">
            <MobileSidebarContent onClose={() => setIsSidebarOpen(false)} />
          </aside>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          {/* Desktop sidebar (hidden on small screens) */}
          <aside className="hidden md:block h-fit rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
            <div className="mb-4">
              <div className="text-sm font-semibold">AI Knowledge Base</div>
              <div className="text-xs text-[var(--muted)]">Light UI redesign</div>
            </div>

            <nav className="space-y-1">
              <NavItem href="/">Home</NavItem>
              <NavItem href="/documents">Documents</NavItem>
              <NavItem href="/ask">Ask</NavItem>
              <NavItem href="/documents/upload">Upload</NavItem>
              <NavItem href="/documents/new">New Note</NavItem>
              <NavItem href="/auth">Auth</NavItem>
            </nav>
          </aside>

          {/* Main */}
          <main className="space-y-6">
            {/* Topbar */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Mobile menu button */}
                <button
                  className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white"
                  onClick={() => setIsSidebarOpen(true)}
                  aria-label="Open menu"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                <div>
                  <div className="text-sm font-semibold">{title}</div>
                  <div className="text-xs text-[var(--muted)]">{subtitle}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {userEmail ? (
                  <>
                    <div className="hidden sm:block text-xs text-[var(--muted)]">
                      {userEmail}
                    </div>
                    <Button variant="ghost" onClick={signOut}>
                      Sign out
                    </Button>
                  </>
                ) : (
                  <Link href="/auth">
                    <Button variant="secondary">Sign in</Button>
                  </Link>
                )}
              </div>
            </div>

            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

function MobileSidebarContent({ onClose }: { onClose?: () => void }) {
  return (
    <div>
      <div className="mb-4">
        <div className="text-sm font-semibold">AI Knowledge Base</div>
        <div className="text-xs text-[var(--muted)]">Light UI redesign</div>
      </div>

      {/* inside MobileSidebarContent */}
      <nav className="space-y-1">
        <NavItem href="/" ><span onClick={onClose}>Home</span></NavItem>
        <NavItem href="/documents" ><span onClick={onClose}>Documents</span></NavItem>
        <NavItem href="/ask" ><span onClick={onClose}>Ask</span></NavItem>
        <NavItem href="/documents/upload" ><span onClick={onClose}>Upload</span></NavItem>
        <NavItem href="/documents/new" ><span onClick={onClose}>New Note</span></NavItem>
        <NavItem href="/auth" ><span onClick={onClose}>Auth</span></NavItem>
      </nav>
    </div>
  );
}

function NavItem({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();

  const isActive =
    pathname === href ||
    (href !== "/" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`block rounded-lg px-3 py-2 text-sm font-medium transition
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--brand-2)]/40
        ${
          isActive
            ? "bg-slate-100 text-[var(--text)] shadow-sm ring-1 ring-[color:var(--brand-2)]/8"
            : "text-[var(--muted)] hover:bg-slate-50 hover:text-[var(--text)]"
        }
      `}
    >
      {children}
    </Link>
  );
}