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
    "transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-2)]/30 " +
    "disabled:opacity-50 disabled:pointer-events-none";

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
      className={`${base} ${styles[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...rest}
    >
      {leftIcon ? <span className="opacity-90">{leftIcon}</span> : null}
      {isLoading ? "Working..." : children}
    </button>
  );
}