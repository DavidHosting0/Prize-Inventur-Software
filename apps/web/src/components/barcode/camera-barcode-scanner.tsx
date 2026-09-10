"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@prize/ui";
import { Link } from "@/i18n/navigation";
import { HardwareBarcodeInput } from "./hardware-barcode-input";
import { normalizeBarcode } from "@/lib/barcode-normalize";

type CameraBarcodeScannerProps = {
  title?: string;
  backHref?: string;
  onBack?: () => void;
  onScan: (code: string) => void;
  /** When true, camera pauses accepting new codes (e.g. while editing qty) */
  pauseCapture?: boolean;
  children?: ReactNode;
  footer?: ReactNode;
  statusMessage?: string | null;
  successFlash?: boolean;
};

/**
 * Fullscreen camera + wedge scanner shell for mobile inventur / receiving.
 */
export function CameraBarcodeScanner({
  title,
  backHref,
  onBack,
  onScan,
  pauseCapture = false,
  children,
  footer,
  statusMessage,
  successFlash = false,
}: CameraBarcodeScannerProps) {
  const t = useTranslations("barcode");
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const onScanRef = useRef(onScan);
  const pauseRef = useRef(pauseCapture);
  const lastCodeRef = useRef("");
  const lastAtRef = useRef(0);
  const [cameraError, setCameraError] = useState(false);

  onScanRef.current = onScan;
  pauseRef.current = pauseCapture;

  function handleDecoded(raw: string) {
    if (pauseRef.current) return;
    const code = normalizeBarcode(raw);
    if (!code) return;
    const now = Date.now();
    if (code === lastCodeRef.current && now - lastAtRef.current < 1200) return;
    lastCodeRef.current = code;
    lastAtRef.current = now;
    try {
      navigator.vibrate?.(40);
    } catch {
      /* ignore */
    }
    onScanRef.current(code);
  }

  useEffect(() => {
    let active = true;
    async function start() {
      if (!scannerRef.current) return;
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const elId = scannerRef.current.id;
        const scanner = new Html5Qrcode(elId);
        html5QrCodeRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 160 } },
          (decoded) => {
            if (active) handleDecoded(decoded);
          },
          () => undefined
        );
      } catch {
        if (active) setCameraError(true);
      }
    }
    start();
    return () => {
      active = false;
      html5QrCodeRef.current?.stop().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] text-[var(--text)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div className="text-sm font-semibold uppercase tracking-wider text-[var(--primary)]">
          {title ?? t("scan")}
        </div>
        {backHref ? (
          <Link href={backHref} className="text-sm text-[var(--text-muted)]">
            {t("close")}
          </Link>
        ) : onBack ? (
          <button
            type="button"
            className="text-sm text-[var(--text-muted)]"
            onClick={onBack}
          >
            {t("close")}
          </button>
        ) : null}
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4">
        <div className="relative aspect-video overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-black">
          <div
            id="universal-camera-scanner"
            ref={scannerRef}
            className="h-full w-full"
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-36 w-56 rounded-md border-2 border-[var(--primary)]/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
          {successFlash ? (
            <div className="pointer-events-none absolute inset-0 bg-[var(--success)]/20" />
          ) : null}
        </div>

        {cameraError ? (
          <div className="text-center text-xs text-[var(--text-muted)]">
            {t("cameraUnavailable")}
          </div>
        ) : null}

        <HardwareBarcodeInput
          onScan={handleDecoded}
          placeholder={t("scanOrType")}
          disabled={pauseCapture}
        />

        {statusMessage ? (
          <div className="text-center text-sm text-[var(--text-muted)]">
            {statusMessage}
          </div>
        ) : null}

        {children}

        {footer}
      </div>
    </div>
  );
}

export function ScanQtyControls({
  qty,
  onChange,
  onConfirm,
  confirmLabel,
  confirming,
}: {
  qty: number;
  onChange: (n: number) => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirming?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-center gap-4">
        <Button
          size="lg"
          variant="secondary"
          className="h-14 w-14 text-2xl"
          onClick={() => onChange(Math.max(0, qty - 1))}
        >
          −
        </Button>
        <input
          type="number"
          className="h-14 w-24 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] text-center text-xl"
          value={qty}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
        />
        <Button
          size="lg"
          variant="secondary"
          className="h-14 w-14 text-2xl"
          onClick={() => onChange(qty + 1)}
        >
          +
        </Button>
      </div>
      <Button
        className="mt-4 h-14 w-full text-base"
        onClick={onConfirm}
        disabled={confirming}
      >
        {confirmLabel}
      </Button>
    </div>
  );
}
