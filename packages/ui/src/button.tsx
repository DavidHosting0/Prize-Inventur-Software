import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] border-transparent shadow-[0_6px_16px_rgba(37,99,235,0.22)]",
  secondary:
    "bg-[var(--card)] text-[var(--text)] border-[var(--border)] hover:bg-[var(--card-hover)] hover:border-[#94a3b8]",
  ghost:
    "bg-transparent text-[var(--text-muted)] border-transparent hover:bg-[var(--card-hover)] hover:text-[var(--text)]",
  danger:
    "bg-[var(--danger-muted)] text-[var(--danger)] border-[var(--danger)]/30 hover:bg-[var(--danger)] hover:text-white",
  success:
    "bg-[var(--success)] text-white hover:bg-[var(--success-hover)] border-transparent",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-xs",
  md: "h-9 px-3 text-sm",
  lg: "h-11 px-4 text-sm",
  icon: "h-8 w-8 p-0 text-sm",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] border font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg)]",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
