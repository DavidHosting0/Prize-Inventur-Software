"use client";

import { useEffect, useRef } from "react";
import { normalizeBarcode } from "@/lib/barcode-normalize";

/**
 * Document-level key buffer for pages that keep focus elsewhere.
 * Prefer HardwareBarcodeInput when a dedicated field is available.
 */
export function useHardwareScanner(
  onScan: (code: string) => void,
  opts?: { enabled?: boolean; minLength?: number; idleMs?: number }
) {
  const enabled = opts?.enabled ?? true;
  const minLength = opts?.minLength ?? 4;
  const idleMs = opts?.idleMs ?? 80;
  const bufferRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    function flush() {
      const code = normalizeBarcode(bufferRef.current);
      bufferRef.current = "";
      if (code.length >= minLength) onScanRef.current(code);
    }

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (timerRef.current) clearTimeout(timerRef.current);
        flush();
        return;
      }
      if (e.key.length !== 1) return;
      bufferRef.current += e.key;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, idleMs);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, minLength, idleMs]);
}
