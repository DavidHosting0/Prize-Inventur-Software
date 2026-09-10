"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@prize/ui";
import { normalizeBarcode } from "@/lib/barcode-normalize";

type HardwareBarcodeInputProps = {
  onScan: (code: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  /** e.g. "pos-barcode" → data-pos-barcode */
  dataName?: string;
  className?: string;
  variant?: "visible" | "hidden";
  debounceMs?: number;
  value?: string;
  onValueChange?: (v: string) => void;
  /** When false, only Enter submits (better for name+barcode hybrid fields). Default true. */
  submitOnIdle?: boolean;
};

/**
 * Keyboard-wedge barcode capture. Scanners type fast then send Enter.
 * Debounces burst input and auto-refocuses after a successful scan.
 */
export function HardwareBarcodeInput({
  onScan,
  placeholder = "Barcode",
  disabled,
  autoFocus = true,
  dataName,
  className,
  variant = "visible",
  debounceMs = 60,
  value: controlled,
  onValueChange,
  submitOnIdle = true,
}: HardwareBarcodeInputProps) {
  const [internal, setInternal] = useState("");
  const value = controlled ?? internal;
  const setValue = onValueChange ?? setInternal;
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScanRef = useRef<string>("");
  const lastScanAtRef = useRef(0);

  const focus = useCallback(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  useEffect(() => {
    if (autoFocus) focus();
  }, [autoFocus, focus]);

  function emit(raw: string) {
    const code = normalizeBarcode(raw);
    if (!code) return;
    const now = Date.now();
    if (code === lastScanRef.current && now - lastScanAtRef.current < 800) {
      setValue("");
      return;
    }
    lastScanRef.current = code;
    lastScanAtRef.current = now;
    setValue("");
    onScan(code);
    requestAnimationFrame(() => focus());
  }

  function onChange(next: string) {
    setValue(next);
    if (!submitOnIdle) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (next.length >= 6) {
      timerRef.current = setTimeout(() => {
        if (document.activeElement === inputRef.current) {
          emit(next);
        }
      }, debounceMs + 40);
    }
  }

  const dataProps = dataName
    ? ({ [`data-${dataName}`]: true } as Record<string, boolean>)
    : {};

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="none"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      disabled={disabled}
      placeholder={placeholder}
      value={value}
      className={cn(
        "h-9 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]",
        variant === "hidden" &&
          "absolute h-px w-px overflow-hidden opacity-0",
        className
      )}
      {...dataProps}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (timerRef.current) clearTimeout(timerRef.current);
          emit(value);
        }
      }}
    />
  );
}
