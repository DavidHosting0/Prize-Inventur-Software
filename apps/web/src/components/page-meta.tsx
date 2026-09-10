"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Crumb } from "./breadcrumbs";

export type PageMeta = {
  title: string;
  subtitle?: string;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
};

type Store = {
  get: () => PageMeta;
  set: (meta: PageMeta) => void;
  subscribe: (listener: () => void) => () => void;
};

const defaultMeta: PageMeta = { title: "Prize Hotel" };

function createStore(): Store {
  let meta = defaultMeta;
  const listeners = new Set<() => void>();
  return {
    get: () => meta,
    set: (next) => {
      meta = next;
      listeners.forEach((l) => l());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const PageMetaContext = createContext<Store | null>(null);

export function PageMetaProvider({ children }: { children: ReactNode }) {
  const store = useMemo(() => createStore(), []);
  return (
    <PageMetaContext.Provider value={store}>{children}</PageMetaContext.Provider>
  );
}

function usePageMetaStore() {
  const store = useContext(PageMetaContext);
  if (!store) {
    throw new Error("Page meta must be used within PageMetaProvider");
  }
  return store;
}

/** Subscribe to header meta (used by the persistent shell chrome). */
export function usePageMetaState() {
  const store = usePageMetaStore();
  const meta = useSyncExternalStore(store.subscribe, store.get, () => defaultMeta);
  return { meta };
}

/** Registers page chrome without remounting the shell or re-rendering siblings. */
export function useSetPageMeta(meta: PageMeta) {
  const store = usePageMetaStore();
  const metaRef = useRef(meta);
  metaRef.current = meta;

  useLayoutEffect(() => {
    store.set(metaRef.current);
  });

  useLayoutEffect(() => {
    return () => {
      store.set(defaultMeta);
    };
  }, [store]);
}
