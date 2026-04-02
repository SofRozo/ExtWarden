import { useState, useEffect } from 'react';
import { storageGet, storageSet, onStorageChange } from '../utils/chromeApi';

/**
 * React hook that syncs state with chrome.storage.local.
 * Falls back to plain useState when not running in a Chrome extension.
 */
export function useChromeStorage<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const [state, setState] = useState<T>(defaultValue);

  // Load initial value
  useEffect(() => {
    storageGet<T>(key, defaultValue).then(setState);
  }, [key]);

  // Listen for external changes (e.g., from service worker or other tabs)
  useEffect(() => {
    return onStorageChange(key, newValue => {
      setState(newValue as T);
    });
  }, [key]);

  const setValue = (value: T) => {
    setState(value);
    storageSet(key, value);
  };

  return [state, setValue];
}
