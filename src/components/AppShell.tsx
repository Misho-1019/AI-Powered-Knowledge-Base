import Link from "next/link";
import type { ReactNode } from "react";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* Subtle “aurora” accent (very light, optional but nice) */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-32 right-[-120px] h-[420px] w-[420px] rounded-full blur-3xl opacity-[0.10]"
             style={{
               background:
                 "radial-gradient(circle at 30% 30%, var(--brand-3), transparent 60%), radial-gradient(circle at 70% 70%, var(--brand-1), transparent 55%)",
             }}
        />
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          {/* Sidebar */}
          <aside className="h-fit rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
            <div className="mb-4">
              <div className="text-sm font-semibold">AI Knowledge Base</div>
              <div className="text-xs text-[var(--muted)]">Light UI redesign</div>
            </div>

            <nav className="space-y-1 text-sm">
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
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Dashboard</div>
                  <div className="text-xs text-[var(--muted)]">
                    Upload, process, then ask questions with sources.
                  </div>
                </div>

                {/* placeholder for later: search / user menu */}
                <div className="hidden sm:block text-xs text-[var(--muted)]">
                  v0 UI shell
                </div>
              </div>
            </div>

            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

function NavItem({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="block rounded-lg px-3 py-2 text-[var(--text)] hover:bg-slate-50"
    >
      {children}
    </Link>
  );
}