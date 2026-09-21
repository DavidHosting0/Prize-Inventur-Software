import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] shadow-none",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--card)] px-4 py-3",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardBody({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-4", className)} {...props}>
      {children}
    </div>
  );
}
