import { useState, useEffect } from 'react';
import { storageGet, onStorageChange, isChromeExtension } from '../utils/chromeApi';
import type { SandboxJob, SandboxReport } from '../types';

export function useSandboxData() {
  const [jobs, setJobs] = useState<Record<string, SandboxJob>>({});
  const [reports, setReports] = useState<Record<string, SandboxReport>>({});

  useEffect(() => {
    storageGet<Record<string, SandboxJob>>('sandboxJobs', {}).then(setJobs);
    storageGet<Record<string, SandboxReport>>('sandboxReports', {}).then(setReports);

    if (!isChromeExtension()) return;

    const unsubJobs = onStorageChange('sandboxJobs', v => {
      setJobs((v as Record<string, SandboxJob>) ?? {});
    });
    const unsubReports = onStorageChange('sandboxReports', v => {
      setReports((v as Record<string, SandboxReport>) ?? {});
    });

    return () => {
      unsubJobs();
      unsubReports();
    };
  }, []);

  return { jobs, reports };
}
