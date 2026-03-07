import { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`
        bg-[var(--card)]
        border border-[var(--border)]
        rounded-xl
        shadow-sm
        p-6
        ${className}
      `}
    >
      {children}
    </div>
  );
}