import type { ReactNode } from "react";
import Card from "@/components/ui/Card";
import Link from "next/link";

type Variant = "info" | "error";

export default function NoticeCard({
  title,
  description,
  variant = "info",
  actionHref,
  actionLabel,
  children,
}: {
  title: string;
  description?: string;
  variant?: Variant;
  actionHref?: string;
  actionLabel?: string;
  children?: ReactNode;
}) {
  const styles =
    variant === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-[var(--border)] bg-white text-[var(--text)]";

  return (
    <Card className={`p-0 overflow-hidden ${styles}`}>
      <div className="px-6 py-5 space-y-3">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {description ? (
            <div className="text-sm text-[var(--muted)]">{description}</div>
          ) : null}
        </div>

        {children}

        {actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="inline-block text-sm font-medium text-[var(--brand-2)] hover:underline"
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </Card>
  );
}