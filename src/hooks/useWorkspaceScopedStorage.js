import { useEffect, useRef, useState } from "react";

export function useWorkspaceScopedStorage({
  workspaceScope,
  key,
  defaultValue,
  normalize = (value) => value,
  fallbackKey,
}) {
  const normalizeRef = useRef(normalize);
  const defaultValueRef = useRef(defaultValue);
  normalizeRef.current = normalize;
  defaultValueRef.current = defaultValue;

  const [value, setValue] = useState(() => {
    try {
      return normalize(defaultValue);
    } catch {
      return defaultValue;
    }
  });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(false);

    try {
      const scopedKey = `${key}:${workspaceScope}`;
      const scopedRaw = window.localStorage.getItem(scopedKey);
      const fallbackRaw = fallbackKey ? window.localStorage.getItem(fallbackKey) : null;
      const parsed = JSON.parse(scopedRaw ?? fallbackRaw ?? JSON.stringify(defaultValueRef.current));
      setValue(normalizeRef.current(parsed));
    } catch {
      setValue(normalizeRef.current(defaultValueRef.current));
    } finally {
      setIsReady(true);
    }
  }, [workspaceScope, key, fallbackKey]);

  useEffect(() => {
    if (!isReady) return;
    try {
      window.localStorage.setItem(`${key}:${workspaceScope}`, JSON.stringify(value));
    } catch {
      // Ignore storage failures.
    }
  }, [workspaceScope, key, value, isReady]);

  return [value, setValue, isReady];
}
