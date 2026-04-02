import { useState, useEffect, useCallback } from 'react';
import { getInstalledExtensions, setExtensionEnabled, isChromeExtension } from '../utils/chromeApi';
import type { InstalledExtension } from '../types';

/**
 * Fetches real installed extensions via chrome.management.getAll().
 * Re-fetches when extensions are installed/uninstalled/enabled/disabled.
 */
export function useExtensions() {
  const [extensions, setExtensions] = useState<InstalledExtension[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const exts = await getInstalledExtensions();
    setExtensions(exts);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();

    // Listen for extension install/uninstall/enable/disable events
    if (isChromeExtension()) {
      chrome.management.onInstalled.addListener(refresh);
      chrome.management.onUninstalled.addListener(refresh);
      chrome.management.onEnabled.addListener(refresh);
      chrome.management.onDisabled.addListener(refresh);
      return () => {
        chrome.management.onInstalled.removeListener(refresh);
        chrome.management.onUninstalled.removeListener(refresh);
        chrome.management.onEnabled.removeListener(refresh);
        chrome.management.onDisabled.removeListener(refresh);
      };
    }
  }, [refresh]);

  const toggleExtension = async (id: string, enabled: boolean) => {
    await setExtensionEnabled(id, enabled);
    // Optimistic update
    setExtensions(prev =>
      prev.map(ext => (ext.id === id ? { ...ext, enabled } : ext)),
    );
  };

  return { extensions, loading, refresh, toggleExtension };
}
