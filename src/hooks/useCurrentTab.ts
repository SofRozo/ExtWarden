import { useState, useEffect } from 'react';
import { getCurrentTabUrl } from '../utils/chromeApi';

/**
 * Gets the hostname of the current active tab.
 */
export function useCurrentTab() {
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentTabUrl().then(hostname => {
      setUrl(hostname);
      setLoading(false);
    });
  }, []);

  return { url, loading };
}
