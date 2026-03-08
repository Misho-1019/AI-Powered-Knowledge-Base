import type { TextareaHTMLAttributes } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  className?: string;
};

export default function Textarea({ className = "", ...props }: Props) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-2)]/30
        placeholder:text-slate-400 ${className}`}
    />
  );
}