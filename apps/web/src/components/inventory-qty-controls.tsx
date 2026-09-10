"use client";

import { useCallback, useRef } from "react";
import { Button, cn } from "@prize/ui";

function formatPreset(n: number): string {
  if (n === 0) return "0";
  if (n === 0.25) return "¼";
  if (n === 0.5) return "½";
  if (n === 0.75) return "¾";
  if (n === 1) return "1";
  return String(n);
}

function BottleFillGauge({
  bottles,
  onChange,
  fullLabel,
  openLabel,
}: {
  bottles: number;
  onChange: (n: number) => void;
  fullLabel: string;
  openLabel: string;
}) {
  const full = Math.floor(Math.max(0, bottles));
  const frac = Math.max(0, Math.min(1, bottles - full));
  const trackRef = useRef<HTMLDivElement>(null);

  const setFromPointer = useCallback(
    (clientY: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = 1 - (clientY - rect.top) / rect.height;
      const clamped = Math.max(0, Math.min(1, ratio));
      const snapped = Math.round(clamped * 20) / 20;
      onChange(full + snapped);
    },
    [full, onChange]
  );

  return (
    <div className="flex items-end justify-center gap-3">
      <div className="text-center">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
          {fullLabel}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onChange(Math.max(0, bottles - 1))}
          >
            −
          </Button>
          <span className="min-w-[2rem] text-center text-lg font-semibold tabular-nums">
            {full}
          </span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onChange(bottles + 1)}
          >
            +
          </Button>
        </div>
      </div>

      <div className="flex flex-col items-center">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
          {openLabel}
        </div>
        <div
          ref={trackRef}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={frac}
          tabIndex={0}
          className="relative h-28 w-12 cursor-ns-resize touch-none select-none rounded-b-[18px] rounded-t-[6px] border-2 border-[var(--border)] bg-[var(--input-bg)] shadow-[var(--shadow-sm)]"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setFromPointer(e.clientY);
          }}
          onPointerMove={(e) => {
            if (e.buttons !== 1) return;
            setFromPointer(e.clientY);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") {
              e.preventDefault();
              onChange(Number((bottles + 0.05).toFixed(2)));
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              onChange(Math.max(0, Number((bottles - 0.05).toFixed(2))));
            }
          }}
        >
          <div
            className="absolute inset-x-0 bottom-0 rounded-b-[16px] bg-[var(--primary)]/80 transition-[height]"
            style={{ height: `${frac * 100}%` }}
          />
          <div className="pointer-events-none absolute inset-x-1 top-2 h-2 rounded-sm bg-[var(--border-subtle)]" />
        </div>
        <div className="mt-1 text-xs tabular-nums text-[var(--text-muted)]">
          {(frac * 100).toFixed(0)}%
        </div>
      </div>
    </div>
  );
}

export function InventoryQtyControls({
  qty,
  onChange,
  onConfirm,
  confirmLabel,
  confirming,
  trackLiquid = false,
  presets = [0, 0.25, 0.5, 0.75, 1],
  step = 0.05,
  unitLabel = "Stk.",
  bottleContentMl,
  showMl = true,
  fullBottlesLabel = "Full",
  openBottleLabel = "Open",
}: {
  qty: number;
  onChange: (n: number) => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirming?: boolean;
  trackLiquid?: boolean;
  presets?: number[];
  step?: number;
  unitLabel?: string;
  bottleContentMl?: number | null;
  showMl?: boolean;
  fullBottlesLabel?: string;
  openBottleLabel?: string;
}) {
  const effectiveStep = trackLiquid ? step : 1;
  const ml =
    trackLiquid && bottleContentMl && bottleContentMl > 0
      ? qty * bottleContentMl
      : null;

  return (
    <div className="space-y-4">
      {trackLiquid ? (
        <BottleFillGauge
          bottles={qty}
          onChange={onChange}
          fullLabel={fullBottlesLabel}
          openLabel={openBottleLabel}
        />
      ) : null}

      {trackLiquid && presets.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-1.5">
          {presets.map((p) => {
            const frac = qty - Math.floor(qty);
            const active = Math.abs(frac - p) < 0.001;
            return (
              <button
                key={p}
                type="button"
                onClick={() => {
                  const full = Math.floor(qty);
                  onChange(Number((full + p).toFixed(3)));
                }}
                className={cn(
                  "rounded-[var(--radius-sm)] border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "border-[var(--primary)] bg-[var(--primary-muted)] text-[var(--primary)]"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
                )}
              >
                {formatPreset(p)}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex items-center justify-center gap-3">
        <Button
          size="lg"
          variant="secondary"
          className="h-14 w-14 text-2xl"
          onClick={() =>
            onChange(Math.max(0, Number((qty - effectiveStep).toFixed(3))))
          }
        >
          −
        </Button>
        <div className="text-center">
          <input
            type="number"
            step={effectiveStep}
            min={0}
            className="h-14 w-28 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] text-center text-xl tabular-nums"
            value={qty}
            onChange={(e) => onChange(Number(e.target.value) || 0)}
          />
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
            {unitLabel}
            {trackLiquid && showMl && ml != null
              ? ` · ${Math.round(ml)} ml`
              : null}
          </div>
        </div>
        <Button
          size="lg"
          variant="secondary"
          className="h-14 w-14 text-2xl"
          onClick={() => onChange(Number((qty + effectiveStep).toFixed(3)))}
        >
          +
        </Button>
      </div>

      <Button
        className="h-14 w-full text-base"
        onClick={onConfirm}
        disabled={confirming}
      >
        {confirmLabel}
      </Button>
    </div>
  );
}
