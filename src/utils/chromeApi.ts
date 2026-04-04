/**
 * Wrappers sobre las APIs de Chrome con fallback para entorno de desarrollo.
 */

import { analyzeExtension } from '../engine/riskEngine';
import type { InstalledExtension, CriticalZone, ActivityEvent } from '../types';

// ── Detección de contexto ─────────────────────────────────────────────────────

export function isChromeExtension(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.runtime?.id;
}

// ── Storage ───────────────────────────────────────────────────────────────────

export function storageGet<T>(key: string, defaultValue: T): Promise<T> {
  if (!isChromeExtension()) return Promise.resolve(defaultValue);
  return new Promise(resolve => {
    chrome.storage.local.get(key, result => {
      resolve(result[key] !== undefined ? (result[key] as T) : defaultValue);
    });
  });
}

export function storageSet(key: string, value: unknown): Promise<void> {
  if (!isChromeExtension()) return Promise.resolve();
  return new Promise(resolve => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

export function onStorageChange(
  key: string,
  callback: (newValue: unknown) => void,
): () => void {
  if (!isChromeExtension()) return () => {};
  const handler = (changes: Record<string, chrome.storage.StorageChange>) => {
    if (key in changes) callback(changes[key].newValue);
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

export async function getCurrentTabUrl(): Promise<string> {
  if (!isChromeExtension()) return '';
  return new Promise(resolve => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const url = tabs[0]?.url ?? '';
      try { resolve(new URL(url).hostname); } catch { resolve(''); }
    });
  });
}

// ── Extensions ────────────────────────────────────────────────────────────────

export async function getInstalledExtensions(): Promise<InstalledExtension[]> {
  if (!isChromeExtension()) {
    const { DUMMY_EXTENSIONS } = await import('../data/dummyData');
    return DUMMY_EXTENSIONS;
  }
  const categoryOverrides = await storageGet<Record<string, string>>('categoryOverrides', {});
  const all = await chrome.management.getAll();
  return all
    .filter(e => e.type === 'extension' && e.id !== chrome.runtime.id)
    .map(e => analyzeExtension(e, categoryOverrides[e.id]))
    .sort((a, b) => b.riskScore - a.riskScore);
}

export function setExtensionEnabled(id: string, enabled: boolean): Promise<void> {
  if (!isChromeExtension()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    chrome.management.setEnabled(id, enabled, () => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve();
    });
  });
}

export async function setCategoryOverride(id: string, category: string): Promise<void> {
  const overrides = await storageGet<Record<string, string>>('categoryOverrides', {});
  overrides[id] = category;
  await storageSet('categoryOverrides', overrides);
}

// ── Zones ─────────────────────────────────────────────────────────────────────

export async function getZones(): Promise<CriticalZone[]> {
  if (!isChromeExtension()) {
    const { DUMMY_ZONES } = await import('../data/dummyData');
    return DUMMY_ZONES;
  }
  return storageGet<CriticalZone[]>('criticalZones', []);
}

export function saveZones(zones: CriticalZone[]): Promise<void> {
  return storageSet('criticalZones', zones);
}

// ── Activity log ──────────────────────────────────────────────────────────────

export async function getActivityLog(): Promise<ActivityEvent[]> {
  if (!isChromeExtension()) {
    const { DUMMY_ACTIVITY } = await import('../data/dummyData');
    return DUMMY_ACTIVITY;
  }
  return storageGet<ActivityEvent[]>('activityLog', []);
}

export async function addActivityEvent(
  event: Omit<ActivityEvent, 'id' | 'timestamp'>,
): Promise<void> {
  const log = await storageGet<ActivityEvent[]>('activityLog', []);
  log.unshift({ ...event, id: `evt-${Date.now()}`, timestamp: new Date().toISOString() });
  await storageSet('activityLog', log.slice(0, 100));
}

// ── Navigation ────────────────────────────────────────────────────────────────

export function openOptionsPage(): void {
  if (isChromeExtension()) chrome.runtime.openOptionsPage();
}

export function sendMessage(message: Record<string, unknown>): void {
  if (isChromeExtension()) chrome.runtime.sendMessage(message);
}
