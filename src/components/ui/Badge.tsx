type Status = "PENDING" | "PROCESSING" | "PROCESSED" | "FAILED";

const styles: Record<Status, string> = {
  PENDING: "bg-slate-100 text-slate-700 border-slate-200",
  PROCESSING: "bg-blue-50 text-blue-700 border-blue-200",
  PROCESSED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  FAILED: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function Badge({
  status,
  className = "",
}: {
  status: Status;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${styles[status]} ${className}`}
      title={status}
    >
      {status}
    </span>
  );
}