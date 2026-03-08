import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  className?: string;
};

export default function Input({ className = "", ...props }: Props) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-2)]/30
        placeholder:text-slate-400 ${className}`}
    />
  );
}