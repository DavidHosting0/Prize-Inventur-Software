"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

type KeyboardContextValue = {
  registerNav: (el: HTMLElement | null) => void;
  focusNav: () => void;
  openShortcutsHelp: () => void;
  shortcutsHelpOpen: boolean;
  setShortcutsHelpOpen: (v: boolean) => void;
};

const KeyboardContext = createContext<KeyboardContextValue | null>(null);

export function useAppKeyboard() {
  const ctx = useContext(KeyboardContext);
  if (!ctx) throw new Error("useAppKeyboard requires KeyboardProvider");
  return ctx;
}

export function useAppKeyboardOptional() {
  return useContext(KeyboardContext);
}

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

/**
 * Roving focus for lists/grids: Arrow keys + Enter/Space activate.
 * Attach `data-kbd-index` to focusable children inside the container.
 */
export function useRovingList(opts?: {
  orientation?: "vertical" | "horizontal" | "both";
  columns?: number;
  onActivate?: (index: number, el: HTMLElement) => void;
}) {
  const orientation = opts?.orientation ?? "vertical";
  const columns = opts?.columns ?? 1;
  const ref = useRef<HTMLElement | null>(null);
  const [active, setActive] = useState(0);

  const items = useCallback(() => {
    if (!ref.current) return [] as HTMLElement[];
    return Array.from(
      ref.current.querySelectorAll<HTMLElement>("[data-kbd-index]")
    ).sort(
      (a, b) =>
        Number(a.dataset.kbdIndex ?? 0) - Number(b.dataset.kbdIndex ?? 0)
    );
  }, []);

  const focusAt = useCallback(
    (index: number) => {
      const list = items();
      if (!list.length) return;
      const next = ((index % list.length) + list.length) % list.length;
      setActive(next);
      list[next]?.focus();
    },
    [items]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const list = items();
      if (!list.length) return;
      let next = active;

      if (orientation === "vertical" || orientation === "both") {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          next = active + (orientation === "both" ? columns : 1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          next = active - (orientation === "both" ? columns : 1);
        }
      }
      if (orientation === "horizontal" || orientation === "both") {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          next = active + 1;
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          next = active - 1;
        }
      }
      if (e.key === "Home") {
        e.preventDefault();
        next = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        next = list.length - 1;
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const el = list[active];
        if (el) {
          opts?.onActivate?.(active, el);
          el.click();
        }
        return;
      }

      if (next !== active) focusAt(next);
    },
    [active, columns, focusAt, items, opts, orientation]
  );

  return { ref, active, setActive, focusAt, onKeyDown };
}

export function KeyboardProvider({
  children,
  onOpenSearch,
  onNavigate,
}: {
  children: ReactNode;
  onOpenSearch: () => void;
  onNavigate: (href: string) => void;
}) {
  const navRef = useRef<HTMLElement | null>(null);
  const goBuffer = useRef<string | null>(null);
  const goTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);

  const registerNav = useCallback((el: HTMLElement | null) => {
    navRef.current = el;
  }, []);

  const focusNav = useCallback(() => {
    const root = navRef.current;
    if (!root) return;
    const active =
      root.querySelector<HTMLElement>("[data-nav-item][data-active='true']") ||
      root.querySelector<HTMLElement>("[data-nav-item]");
    active?.focus();
  }, []);

  const openShortcutsHelp = useCallback(() => setShortcutsHelpOpen(true), []);

  useEffect(() => {
    function clearGo() {
      goBuffer.current = null;
      if (goTimer.current) clearTimeout(goTimer.current);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShortcutsHelpOpen(false);
        return;
      }

      if (isTypingTarget(e.target) && e.key !== "Escape") {
        // Still allow Ctrl/Cmd+K from inputs
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
          e.preventDefault();
          onOpenSearch();
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenSearch();
        return;
      }

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setShortcutsHelpOpen(true);
        return;
      }

      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onOpenSearch();
        return;
      }

      // Focus sidebar
      if (e.key === "[" || (e.altKey && e.key.toLowerCase() === "n")) {
        e.preventDefault();
        focusNav();
        return;
      }

      // Alt+digit shortcuts
      if (e.altKey && !e.ctrlKey && !e.metaKey && /^[1-8]$/.test(e.key)) {
        e.preventDefault();
        const map: Record<string, string> = {
          "1": "/dashboard",
          "2": "/pos",
          "3": "/warehouse",
          "4": "/inventory",
          "5": "/goods-receipt",
          "6": "/orders",
          "7": "/products",
          "8": "/reports",
        };
        onNavigate(map[e.key]!);
        return;
      }

      // g then key (go chord)
      if (!e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        goBuffer.current = "g";
        if (goTimer.current) clearTimeout(goTimer.current);
        goTimer.current = setTimeout(clearGo, 1200);
        return;
      }

      if (goBuffer.current === "g" && !e.altKey && !e.ctrlKey && !e.metaKey) {
        const chord = e.key.toLowerCase();
        const map: Record<string, string> = {
          d: "/dashboard",
          p: "/pos",
          w: "/warehouse",
          i: "/inventory",
          r: "/goods-receipt",
          o: "/orders",
          u: "/suppliers",
          a: "/products",
          c: "/recipes",
          f: "/food-waste",
          b: "/breakfast",
          m: "/minibar",
          e: "/reports",
          n: "/users",
          ",": "/settings",
        };
        if (map[chord]) {
          e.preventDefault();
          onNavigate(map[chord]);
        }
        clearGo();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearGo();
    };
  }, [focusNav, onNavigate, onOpenSearch]);

  const value = useMemo(
    () => ({
      registerNav,
      focusNav,
      openShortcutsHelp,
      shortcutsHelpOpen,
      setShortcutsHelpOpen,
    }),
    [focusNav, openShortcutsHelp, registerNav, shortcutsHelpOpen]
  );

  return (
    <KeyboardContext.Provider value={value}>{children}</KeyboardContext.Provider>
  );
}
