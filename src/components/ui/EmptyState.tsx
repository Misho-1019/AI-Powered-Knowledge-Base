// src/components/ui/EmptyState.tsx
import Button from "./Button";
import type { ReactNode } from "react";

export default function EmptyState({
  title,
  subtitle,
  ctaLabel,
  ctaHref,
  icon,
  className = "",
}: {
  title: string;
  subtitle?: string | ReactNode;
  ctaLabel?: string;
  ctaHref?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`px-6 py-12 text-center ${className}`}>
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
        {icon || <span className="text-2xl">📄</span>}
      </div>

      <div className="text-sm font-semibold">{title}</div>
      {subtitle ? (
        <div className="mt-1 text-sm text-[var(--muted)]">{subtitle}</div>
      ) : null}

      {ctaLabel && ctaHref ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <a
            href={ctaHref}
            className="rounded-lg bg-gradient-to-r from-[var(--brand-1)] via-[var(--brand-2)] to-[var(--brand-3)] px-3 py-2 text-sm font-medium text-white shadow-sm hover:brightness-[1.02] transition"
          >
            {ctaLabel}
          </a>
        </div>
      ) : null}
    </div>
  );
}