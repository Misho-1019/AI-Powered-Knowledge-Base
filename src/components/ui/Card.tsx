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
        transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md motion-safe:transform-gpu
        ${className}
      `}
    >
      {children}
    </div>
  );
}