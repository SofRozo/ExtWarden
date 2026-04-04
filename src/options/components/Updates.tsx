import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { storageGet, storageSet, setExtensionEnabled } from '../../utils/chromeApi';

interface ExtensionSnapshot {
  id: string;
  name: string;
  version: string;
  permissions: string[];
  hostPermissions: string[];
}

interface ChangeRecord {
  id: string;
  timestamp: string;
  extensionId: string;
  extensionName: string;
  type: 'version_change' | 'new_permissions' | 'removed_permissions' | 'installed' | 'uninstalled';
  details: string;
  newPermissions?: string[];
  autoDisabled?: boolean;
}

const TYPE_STYLES: Record<ChangeRecord['type'], { color: string; icon: string }> = {
  version_change:      { color: 'text-blue-600 bg-blue-50',    icon: '#3B82F6' },
  new_permissions:     { color: 'text-red-600 bg-red-50',      icon: '#EF4444' },
  removed_permissions: { color: 'text-emerald-600 bg-emerald-50', icon: '#10B981' },
  installed:           { color: 'text-purple-600 bg-purple-50', icon: '#7c3aed' },
  uninstalled:         { color: 'text-gray-600 bg-gray-100',   icon: '#6B7280' },
};

export default function Updates() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language?.startsWith('es') ? 'es' : 'en') as 'es' | 'en';
  const [changes, setChanges]     = useState<ChangeRecord[]>([]);
  const [pending, setPending]     = useState<ChangeRecord[]>([]);
  const [firstRun, setFirstRun]   = useState(false);

  useEffect(() => {
    loadChanges();
    detectChanges();
  }, []);

  async function loadChanges() {
    const stored = await storageGet<ChangeRecord[]>('changeHistory', []);
    if (stored.length === 0) {
      const snapshots = await storageGet<ExtensionSnapshot[]>('extensionSnapshots', []);
      setFirstRun(snapshots.length === 0);
    }
    setChanges(stored);
    setPending(stored.filter(c => c.type === 'new_permissions' && c.autoDisabled));
  }

  async function detectChanges() {
    if (typeof chrome === 'undefined' || !chrome.management) return;

    const previous = await storageGet<ExtensionSnapshot[]>('extensionSnapshots', []);
    const current  = await chrome.management.getAll();
    const now      = Date.now();
    const newRecords: ChangeRecord[] = [];

    for (const ext of current) {
      if (ext.type !== 'extension' || ext.id === chrome.runtime.id) continue;
      const prev = previous.find(p => p.id === ext.id);
      const perms = ext.permissions ?? [];
      const hosts = ext.hostPermissions ?? [];

      if (!prev) {
        newRecords.push({
          id: `chg-${now}-${ext.id}`,
          timestamp: new Date().toISOString(),
          extensionId: ext.id,
          extensionName: ext.name,
          type: 'installed',
          details: `v${ext.version}`,
        });
        continue;
      }

      if (prev.version !== ext.version) {
        const added = [
          ...perms.filter(p => !prev.permissions.includes(p)),
          ...hosts.filter(h => !prev.hostPermissions.includes(h)),
        ];

        if (added.length > 0) {
          // Auto-disable: zero-trust approach
          try { await chrome.management.setEnabled(ext.id, false); } catch {}
          newRecords.push({
            id: `chg-${now}-${ext.id}`,
            timestamp: new Date().toISOString(),
            extensionId: ext.id,
            extensionName: ext.name,
            type: 'new_permissions',
            details: `v${prev.version} → v${ext.version}`,
            newPermissions: added,
            autoDisabled: true,
          });
        } else {
          newRecords.push({
            id: `chg-${now}-${ext.id}`,
            timestamp: new Date().toISOString(),
            extensionId: ext.id,
            extensionName: ext.name,
            type: 'version_change',
            details: `v${prev.version} → v${ext.version}`,
          });
        }
      }
    }

    // Detect uninstalled
    for (const snap of previous) {
      if (!current.find(e => e.id === snap.id)) {
        newRecords.push({
          id: `chg-${now}-${snap.id}`,
          timestamp: new Date().toISOString(),
          extensionId: snap.id,
          extensionName: snap.name,
          type: 'uninstalled',
          details: snap.name,
        });
      }
    }

    if (newRecords.length > 0) {
      const all = await storageGet<ChangeRecord[]>('changeHistory', []);
      const updated = [...newRecords, ...all].slice(0, 100);
      await storageSet('changeHistory', updated);
      setChanges(updated);
      setPending(updated.filter(c => c.type === 'new_permissions' && c.autoDisabled));
    }

    // Save new snapshot
    const snapshot: ExtensionSnapshot[] = current
      .filter(e => e.type === 'extension' && e.id !== chrome.runtime.id)
      .map(e => ({
        id: e.id, name: e.name, version: e.version,
        permissions: e.permissions ?? [],
        hostPermissions: e.hostPermissions ?? [],
      }));
    await storageSet('extensionSnapshots', snapshot);
  }

  async function reEnable(record: ChangeRecord) {
    await setExtensionEnabled(record.extensionId, true);
    const updated = changes.map(c =>
      c.id === record.id ? { ...c, autoDisabled: false } : c
    );
    await storageSet('changeHistory', updated);
    setChanges(updated);
    setPending(prev => prev.filter(p => p.id !== record.id));
  }

  async function clearHistory() {
    await storageSet('changeHistory', []);
    setChanges([]);
    setPending([]);
  }

  const typeLabel = (type: ChangeRecord['type']) => {
    const key = `updates.changeTypes.${type}` as const;
    return t(key as string);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('updates.title')}</h1>
          <p className="text-sm text-gray-400 mt-0.5 max-w-xl">{t('updates.subtitle')}</p>
        </div>
        {changes.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-xs px-3 py-1.5 text-gray-500 hover:text-red-600 bg-surface-100 hover:bg-red-50 rounded-lg transition-colors"
          >
            {t('updates.clearHistory')}
          </button>
        )}
      </div>

      {/* Pending review banner */}
      {pending.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <p className="text-sm font-semibold text-red-700 mb-3">{t('updates.pendingReview')}</p>
          <div className="space-y-2">
            {pending.map(rec => (
              <div key={rec.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-gray-800 truncate">{rec.extensionName}</span>
                  {rec.newPermissions?.map(p => (
                    <span key={p} className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-mono">
                      {p}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => reEnable(rec)}
                  className="flex-shrink-0 text-xs px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold transition-colors"
                >
                  {t('updates.reEnable')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Changes feed */}
      <div className="bg-white rounded-2xl [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]">
        {firstRun ? (
          <p className="px-6 py-10 text-sm text-gray-400 text-center">{t('updates.firstRun')}</p>
        ) : changes.length === 0 ? (
          <p className="px-6 py-10 text-sm text-gray-400 text-center">{t('updates.noChanges')}</p>
        ) : (
          <div className="divide-y divide-surface-100">
            {changes.map(rec => {
              const style = TYPE_STYLES[rec.type];
              return (
                <div key={rec.id} className="flex items-start gap-4 px-6 py-4 hover:bg-surface-50 transition-colors">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: `${style.icon}15` }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: style.icon }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-800">{rec.extensionName}</p>
                      {rec.autoDisabled && (
                        <span className="text-[10px] font-semibold bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                          {lang === 'es' ? 'DESACTIVADA' : 'DISABLED'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      <span className={`font-medium text-[11px] px-1.5 py-0.5 rounded ${style.color}`}>
                        {typeLabel(rec.type)}
                      </span>
                      {rec.details && <span className="ml-2 text-gray-400">{rec.details}</span>}
                    </p>
                    {rec.newPermissions && rec.newPermissions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {rec.newPermissions.map(p => (
                          <span key={p} className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded font-mono">
                            +{p}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-300 flex-shrink-0 mt-1">
                    {new Date(rec.timestamp).toLocaleString([], {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
