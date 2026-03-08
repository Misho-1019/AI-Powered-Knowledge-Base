import type { SelectHTMLAttributes } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  className?: string;
};

export default function Select({ className = "", ...props }: Props) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-2)]/30
        ${className}`}
    />
  );
}