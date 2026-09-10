import { useEffect, useRef } from "react";

/** Lightweight stand-in for navigation focus: runs on mount and when `active` flips true. */
export function useFocusEffect(callback: () => void, active = true) {
  const cb = useRef(callback);
  cb.current = callback;

  useEffect(() => {
    if (!active) return;
    cb.current();
  }, [active]);
}
