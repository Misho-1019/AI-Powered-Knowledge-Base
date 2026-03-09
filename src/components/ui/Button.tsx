// src/components/ui/Button.tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  isLoading?: boolean;
  leftIcon?: ReactNode;
};

export default function Button({
  variant = "primary",
  isLoading = false,
  leftIcon,
  className = "",
  disabled,
  children,
  ...rest
}: Props) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium " +
    "transition shadow-sm transition-transform duration-150 ease-out hover:-translate-y-[1px]" +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--brand-2)]/30 " +
    "disabled:opacity-50 disabled:pointer-events-none";

  const interaction =
    "active:scale-95 active:translate-y-[1px] motion-safe:transform-gpu";

  const styles: Record<Variant, string> = {
    primary:
      "text-white bg-gradient-to-r from-[var(--brand-1)] via-[var(--brand-2)] to-[var(--brand-3)] " +
      "hover:brightness-[1.02]",
    secondary:
      "bg-white text-[var(--text)] border border-[var(--border)] hover:bg-slate-50",
    ghost: "bg-transparent text-[var(--text)] hover:bg-slate-100",
  };

  return (
    <button
      className={`${base} ${interaction} ${styles[variant]} ${className}`}
      disabled={disabled || isLoading}
      aria-busy={isLoading ? "true" : undefined}
      {...rest}
    >
      {/* left icon — keep it visually present but slightly dim to prioritize spinner/text when loading */}
      {leftIcon ? (
        <span className={`${isLoading ? "opacity-60" : "opacity-90"}`}>{leftIcon}</span>
      ) : null}

      {/* loading spinner (small, inline SVG) + accessible label */}
      {isLoading ? (
        <>
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          <span className="sr-only">Working…</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}