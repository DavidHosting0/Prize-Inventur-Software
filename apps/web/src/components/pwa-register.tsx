"use client";

import { useEffect } from "react";

/** Registers the lightweight service worker (PWA shell). Disabled in development. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Dev + Turbopack: a SW that touches RSC fetches can stall navigations for many seconds.
    if (process.env.NODE_ENV === "development") {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) void reg.unregister();
      });
      void caches.keys().then((keys) => {
        for (const key of keys) void caches.delete(key);
      });
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* ignore — optional enhancement */
    });
  }, []);
  return null;
}
