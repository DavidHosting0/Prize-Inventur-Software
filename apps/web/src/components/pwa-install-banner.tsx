"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@prize/ui";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("prize-pwa-dismissed") === "1") {
      setDismissed(true);
      return;
    }
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (dismissed || !deferred) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-lg items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 shadow-xl desktop:left-auto">
      <Download className="h-4 w-4 shrink-0 text-[var(--primary)]" />
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-medium">Prize Hotel installieren</div>
        <div className="text-xs text-[var(--text-muted)]">
          Als App auf dem Gerät nutzen (PWA)
        </div>
      </div>
      <Button
        size="sm"
        onClick={async () => {
          await deferred.prompt();
          setDeferred(null);
        }}
      >
        Install
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          localStorage.setItem("prize-pwa-dismissed", "1");
          setDismissed(true);
        }}
      >
        Später
      </Button>
    </div>
  );
}
