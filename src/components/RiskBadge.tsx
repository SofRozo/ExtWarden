import type { RiskLevel } from '../types';

const BADGE_STYLES: Record<RiskLevel, string> = {
  critical: 'bg-risk-criticalBg text-risk-criticalText',
  high:     'bg-orange-50 text-orange-700',
  medium:   'bg-risk-warningBg text-risk-warningText',
  low:      'bg-blue-50 text-blue-700',
  safe:     'bg-risk-safeBg text-risk-safeText',
};

const LABELS: Record<RiskLevel, { es: string; en: string }> = {
  critical: { es: 'Crítico',   en: 'Critical' },
  high:     { es: 'Alto',      en: 'High'     },
  medium:   { es: 'Moderado',  en: 'Moderate' },
  low:      { es: 'Bajo',      en: 'Low'      },
  safe:     { es: 'Seguro',    en: 'Safe'     },
};

interface RiskBadgeProps {
  level: RiskLevel;
  lang?: 'es' | 'en';
  className?: string;
}

export default function RiskBadge({ level, lang = 'es', className = '' }: RiskBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${BADGE_STYLES[level]} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {LABELS[level][lang]}
    </span>
  );
}
