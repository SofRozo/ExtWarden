import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { sendMessage } from '../utils/chromeApi';
import type { InstalledExtension } from '../types';

interface AlertOverlayProps {
  extension: InstalledExtension;
  zoneName: string;
  onDismiss: () => void;
}

export default function AlertOverlay({ extension, onDismiss }: AlertOverlayProps) {
  const { t } = useTranslation();
  const [closing, setClosing] = useState(false);

  const handleDismiss = () => {
    setClosing(true);
    setTimeout(onDismiss, 300);
  };

  const handleDisable = () => {
    sendMessage({ action: 'disableExtension', extensionId: extension.id });
    handleDismiss();
  };

  return (
    <div
      className={`fixed bottom-6 right-6 z-[2147483647] max-w-[380px] transition-all duration-300 ${
        closing ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
      }`}
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
    >
      <div className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.15),0_4px_16px_rgba(0,0,0,0.08)] p-5 border-l-4 border-red-500">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-800 flex-1">{t('alert.title')}</p>
          <button onClick={handleDismiss} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Message */}
        <p className="text-[13px] text-gray-500 leading-relaxed mb-4">
          {t('alert.message', { name: extension.name, level: t(`risk.${extension.riskLevel}`) })}
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleDismiss}
            className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-surface-50 border border-surface-200 rounded-xl hover:bg-surface-100 transition-colors"
          >
            {t('alert.dismiss')}
          </button>
          <button
            onClick={handleDisable}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-colors"
          >
            {t('alert.disableExt')}
          </button>
        </div>
      </div>
    </div>
  );
}
