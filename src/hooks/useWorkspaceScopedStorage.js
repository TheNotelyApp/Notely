import { useEffect, useState } from "react";

export function useWorkspaceScopedStorage({
  workspaceScope,
  key,
  defaultValue,
  normalize = (value) => value,
  fallbackKey,
}) {
  const [value, setValue] = useState(defaultValue);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(false);

    try {
      const scopedKey = `${key}:${workspaceScope}`;
      const scopedRaw = window.localStorage.getItem(scopedKey);
      const fallbackRaw = fallbackKey ? window.localStorage.getItem(fallbackKey) : null;
      const parsed = JSON.parse(scopedRaw ?? fallbackRaw ?? JSON.stringify(defaultValue));
      setValue(normalize(parsed));
    } catch {
      setValue(normalize(defaultValue));
    } finally {
      setIsReady(true);
    }
  }, [workspaceScope, key, fallbackKey, defaultValue, normalize]);

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
