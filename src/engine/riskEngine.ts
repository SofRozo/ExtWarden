// Motor de Auditoria - Formula de calculo de riesgo (Seccion 4.4, Tesis ExtWarden)
//
// Riesgo = Sum(i en S) [Peso_i x f(H)]   (permisos sensibles a host)
//        + Sum(j en E) [Peso_j]          (permisos estaticos)
//
// Factor de alcance f(H):
//   Sin host_permissions ni activeTab : 0.0
//   Solo activeTab                    : 0.3
//   Dominios especificos              : 0.5
//   Wildcards amplios (star://)       : 0.8
//   <all_urls> o equivalente          : 1.0
//
// Umbrales de interpretacion:
//   0-5 Bajo | 6-15 Moderado | 16-30 Alto | 31+ Critico

import { PERMISSION_WEIGHTS, type PermissionLevel } from '../data/permissionWeights';
import type { RiskLevel, InstalledExtension } from '../types';

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface PermissionDetail {
  permission: string;
  weight: number;
  level: PermissionLevel | 'medium';
  hostSensitive: boolean;
  hostFactor: number;
  contribution: number;
}

export interface RiskBreakdown {
  score: number;
  level: RiskLevel;
  hostFactor: number;
  lowPermissions: string[];
  mediumAndHighPermissions: string[];
  criticalPermissions: string[];
  permissionDetails: PermissionDetail[];
}

// ── Factor de alcance f(H) ────────────────────────────────────────────────────

/**
 * Calcula f(H) según la amplitud de los host_permissions declarados.
 * activeTab como único mecanismo de acceso → f(H) = 0.3.
 * <all_urls> y *:/ /* equivalentes → f(H) = 1.0.
 * Los patrones de host NO se incluyen como permisos en la suma.
 */
export function computeHostFactor(hostPermissions: string[], permissions: string[]): number {
  if (hostPermissions.length > 0) {
    // <all_urls> o equivalente universal
    if (hostPermissions.some(h =>
      h === '<all_urls>' || h === '*://*/*' || h === 'http://*/*' || h === 'https://*/*'
    )) {
      return 1.0;
    }
    // Wildcards amplios: *://*.domain.com/* o *://*.*/*
    if (hostPermissions.some(h => {
      const m = h.match(/^[*a-z]+:\/\/(.+?)\/.*$/);
      return m && (m[1] === '*' || m[1] === '*.*');
    })) {
      return 0.8;
    }
    // Dominios específicos
    return 0.5;
  }
  // Sin host_permissions: revisar activeTab
  return permissions.includes('activeTab') ? 0.3 : 0.0;
}

// ── Conversión puntaje → nivel ────────────────────────────────────────────────

export function scoreToLevel(score: number): RiskLevel {
  if (score > 30) return 'critical';
  if (score > 15) return 'high';
  if (score > 5) return 'medium';
  if (score > 0)  return 'low';
  return 'safe';
}

// ── Cálculo principal ─────────────────────────────────────────────────────────

/**
 * Aplica la fórmula de riesgo de la tesis a una extensión.
 *
 * @param permissions     Campo "permissions" del manifest
 * @param hostPermissions Campo "host_permissions" del manifest
 * @param category        Se conserva para compatibilidad visual; no afecta el puntaje.
 */
export function computeRisk(
  permissions: string[],
  hostPermissions: string[],
  category?: string,
): RiskBreakdown {
  void category;
  const hostFactor = computeHostFactor(hostPermissions, permissions);

  const lowPermissions: string[] = [];
  const mediumAndHighPermissions: string[] = [];
  const criticalPermissions: string[] = [];
  const permissionDetails: PermissionDetail[] = [];
  let score = 0;

  for (const perm of permissions) {
    // Permisos de plataforma/ChromeOS desconocidos → peso por defecto MEDIO
    const info = PERMISSION_WEIGHTS[perm] ?? { weight: 2, hostSensitive: false, level: 'medium' as const };

    // f(H) se aplica solo a permisos del conjunto S
    // Excepción: activeTab se trata como E en la suma (Ejemplos 4.4.2)
    const effectiveHostFactor = (info.hostSensitive && perm !== 'activeTab')
      ? hostFactor
      : 1.0;

    const contribution = info.weight * effectiveHostFactor;

    if (info.level === 'critical') criticalPermissions.push(perm);
    else if (info.level === 'low') lowPermissions.push(perm);
    else mediumAndHighPermissions.push(perm);

    permissionDetails.push({
      permission: perm,
      weight: info.weight,
      level: info.level,
      hostSensitive: info.hostSensitive,
      hostFactor: effectiveHostFactor,
      contribution,
    });

    score += contribution;
  }

  score = Math.round(score * 10) / 10;

  return {
    score,
    level: scoreToLevel(score),
    hostFactor,
    lowPermissions,
    mediumAndHighPermissions,
    criticalPermissions,
    permissionDetails: permissionDetails.sort((a, b) => b.contribution - a.contribution),
  };
}

// ── Inferencia de categoría ───────────────────────────────────────────────────

/**
 * Heurística basada en nombre/descripción de la extensión cuando no hay
 * categoría explícita disponible via chrome.management.
 */
export function inferCategory(ext: chrome.management.ExtensionInfo): string {
  if (ext.type === 'theme') return 'Art & Design';

  const text = `${ext.name} ${ext.description ?? ''}`.toLowerCase();

  if (text.includes('vpn') || text.includes('proxy') || text.includes('privacy') ||
      text.includes('blocker') || text.includes('adblock'))
    return 'Privacy & Security';
  if (text.includes('devtools') || text.includes('developer') || text.includes('debug') ||
      text.includes('react') || text.includes('vue') || text.includes('angular'))
    return 'Developer Tools';
  if (text.includes('shop') || text.includes('coupon') || text.includes('price') ||
      text.includes('deal') || text.includes('honey'))
    return 'Shopping';
  if (text.includes('grammar') || text.includes('writing') || text.includes('spell') ||
      text.includes('translate') || text.includes('learn'))
    return 'Education';
  if (text.includes('social') || text.includes('facebook') || text.includes('twitter') ||
      text.includes('instagram') || text.includes('linkedin'))
    return 'Social Networking';
  if (text.includes('news') || text.includes('weather') || text.includes('rss'))
    return 'News & Weather';
  if (text.includes('game') || text.includes('play'))
    return 'Games';
  if (text.includes('video') || text.includes('music') || text.includes('stream') ||
      text.includes('youtube') || text.includes('netflix'))
    return 'Entertainment';
  if (text.includes('accessibility') || text.includes('screen reader') ||
      text.includes('color blind'))
    return 'Accessibility';
  if (text.includes('dark') || text.includes('theme') || text.includes('color') ||
      text.includes('design') || text.includes('screenshot'))
    return 'Art & Design';
  if (text.includes('calendar') || text.includes('task') || text.includes('todo') ||
      text.includes('project') || text.includes('workflow'))
    return 'Workflow & Planning';
  if (text.includes('email') || text.includes('mail') || text.includes('chat') ||
      text.includes('message') || text.includes('slack') || text.includes('zoom'))
    return 'Communication';

  return 'Tools';
}

// ── Conversión chrome.management → InstalledExtension ────────────────────────

/**
 * Analiza una extensión instalada y retorna su representación completa con
 * puntaje de riesgo calculado según la fórmula de la tesis.
 */
export function analyzeExtension(
  ext: chrome.management.ExtensionInfo,
  categoryOverride?: string,
): InstalledExtension {
  const permissions     = ext.permissions     ?? [];
  const hostPermissions = ext.hostPermissions ?? [];
  const category        = categoryOverride ?? inferCategory(ext);

  const breakdown = computeRisk(permissions, hostPermissions, category);

  return {
    id:      ext.id,
    name:    ext.name,
    version: ext.version,
    enabled: ext.enabled,
    icons:   (ext.icons ?? []).map((i: { size: number; url: string }) => ({ size: i.size, url: i.url })),
    permissions,
    hostPermissions,
    category,
    riskScore: breakdown.score,
    riskLevel: breakdown.level,
    lowPermissions: breakdown.lowPermissions,
    elevatedPermissions: breakdown.mediumAndHighPermissions,
    criticalPermissions: breakdown.criticalPermissions,
  };
}
