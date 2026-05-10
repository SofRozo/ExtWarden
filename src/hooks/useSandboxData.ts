import { useState, useEffect } from 'react';
import { storageGet, onStorageChange, isChromeExtension } from '../utils/chromeApi';
import type { SandboxJob, SandboxReport } from '../types';

/**
 * Drops reports stored under the previous backend contract (which had
 * `findings`/`privacyLabels`/`recommendation`/etc.) so the new UI never
 * tries to access fields that don't exist. The new contract requires
 * `hallazgos_estaticos_positivos`/`hallazgos_dinamicos_positivos` arrays.
 */
function isCompatibleReport(r: unknown): r is SandboxReport {
  if (!r || typeof r !== 'object') return false;
  const rep = r as Record<string, unknown>;
  return (
    Array.isArray(rep.hallazgos_estaticos_positivos) &&
    Array.isArray(rep.hallazgos_dinamicos_positivos) &&
    Array.isArray(rep.dominios_contactados_prioritarios)
  );
}

function filterCompatible(
  raw: Record<string, unknown> | null | undefined,
): Record<string, SandboxReport> {
  if (!raw) return {};
  const out: Record<string, SandboxReport> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (isCompatibleReport(v)) out[k] = v;
  }
  return out;
}

export function useSandboxData() {
  const [jobs, setJobs] = useState<Record<string, SandboxJob>>({});
  const [reports, setReports] = useState<Record<string, SandboxReport>>({});

  useEffect(() => {
    storageGet<Record<string, SandboxJob>>('sandboxJobs', {}).then(setJobs);
    storageGet<Record<string, unknown>>('sandboxReports', {}).then((raw) =>
      setReports(filterCompatible(raw)),
    );

    if (!isChromeExtension()) return;

    const unsubJobs = onStorageChange('sandboxJobs', v => {
      setJobs((v as Record<string, SandboxJob>) ?? {});
    });
    const unsubReports = onStorageChange('sandboxReports', v => {
      setReports(filterCompatible(v as Record<string, unknown>));
    });

    return () => {
      unsubJobs();
      unsubReports();
    };
  }, []);

  return { jobs, reports };
}
