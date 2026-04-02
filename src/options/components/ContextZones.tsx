import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getZones, saveZones } from '../../utils/chromeApi';
import type { CriticalZone } from '../../types';

export default function ContextZones() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language?.startsWith('es') ? 'es' : 'en') as 'es' | 'en';
  const [zones, setZones] = useState<CriticalZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newUrl, setNewUrl] = useState('');

  // Editing: add URL to existing zone
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addUrl, setAddUrl] = useState('');

  useEffect(() => {
    getZones().then(z => { setZones(z); setLoading(false); });
  }, []);

  const persistZones = (updated: CriticalZone[]) => {
    setZones(updated);
    saveZones(updated);
  };

  const createZone = () => {
    if (!newCategory.trim() || !newUrl.trim()) return;
    const urls = newUrl.split(',').map(u => u.trim()).filter(Boolean);
    if (urls.length === 0) return;

    persistZones([...zones, {
      id: `zone-${Date.now()}`,
      category: newCategory.trim(),
      patterns: urls,
      blockedExtensions: [],
      createdAt: new Date().toISOString(),
    }]);
    setNewCategory('');
    setNewUrl('');
    setShowForm(false);
  };

  const deleteZone = (id: string) => persistZones(zones.filter(z => z.id !== id));

  const addUrlToZone = (zoneId: string) => {
    if (!addUrl.trim()) return;
    const urls = addUrl.split(',').map(u => u.trim()).filter(Boolean);
    persistZones(zones.map(z =>
      z.id === zoneId
        ? { ...z, patterns: [...z.patterns, ...urls.filter(u => !z.patterns.includes(u))] }
        : z
    ));
    setAddUrl('');
    setAddingTo(null);
  };

  const removeUrlFromZone = (zoneId: string, pattern: string) => {
    persistZones(zones.map(z =>
      z.id === zoneId
        ? { ...z, patterns: z.patterns.filter(p => p !== pattern) }
        : z
    ));
  };

  const labels = {
    title: lang === 'es' ? 'Zonas Seguras' : 'Safe Zones',
    subtitle: lang === 'es'
      ? 'Agrupa sitios sensibles por categoría. Las extensiones riesgosas serán bloqueadas en estos sitios.'
      : 'Group sensitive sites by category. Risky extensions will be blocked on these sites.',
    newCategory: lang === 'es' ? 'Nueva categoría' : 'New category',
    categoryName: lang === 'es' ? 'Nombre de la categoría' : 'Category name',
    categoryPlaceholder: lang === 'es' ? 'ej: Banca, Universidad, IA...' : 'e.g.: Banking, University, AI...',
    urls: lang === 'es' ? 'URLs (separadas por coma)' : 'URLs (comma separated)',
    urlPlaceholder: lang === 'es' ? 'ej: *.bancolombia.com, *.davivienda.com' : 'e.g.: *.bank.com, *.otherbank.com',
    addUrl: lang === 'es' ? 'Agregar URL' : 'Add URL',
    addUrlPlaceholder: lang === 'es' ? 'Nueva URL...' : 'New URL...',
    noZones: lang === 'es' ? 'No hay zonas configuradas. Crea una categoría para empezar.' : 'No zones configured. Create a category to get started.',
    sites: lang === 'es' ? 'sitios' : 'sites',
    deleteCategory: lang === 'es' ? 'Eliminar' : 'Delete',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{labels.title}</h1>
          <p className="text-sm text-gray-400 mt-0.5 max-w-xl">{labels.subtitle}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {labels.newCategory}
        </button>
      </div>

      {/* New Category Form */}
      {showForm && (
        <div className="bg-white border border-surface-200 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">{labels.categoryName}</label>
            <input
              type="text"
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              placeholder={labels.categoryPlaceholder}
              className="w-full px-4 py-2.5 bg-surface-50 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">{labels.urls}</label>
            <input
              type="text"
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              placeholder={labels.urlPlaceholder}
              className="w-full px-4 py-2.5 bg-surface-50 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-all"
            />
            <p className="text-[11px] text-gray-300 mt-1.5">
              {lang === 'es' ? 'Usa *.dominio.com para incluir subdominios' : 'Use *.domain.com to include subdomains'}
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => { setShowForm(false); setNewCategory(''); setNewUrl(''); }} className="px-4 py-2 text-sm text-gray-500 hover:bg-surface-100 rounded-xl transition-colors">
              {t('common.cancel')}
            </button>
            <button onClick={createZone} className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold transition-colors">
              {t('common.save')}
            </button>
          </div>
        </div>
      )}

      {/* Zone Categories */}
      {zones.length === 0 ? (
        <div className="bg-white border border-surface-200 rounded-2xl p-12 text-center">
          <div className="w-12 h-12 bg-surface-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          </div>
          <p className="text-gray-400 text-sm">{labels.noZones}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {zones.map(zone => (
            <div key={zone.id} className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
              {/* Category Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-brand-100 rounded-xl flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">{zone.category}</h3>
                    <p className="text-[11px] text-gray-400">{zone.patterns.length} {labels.sites}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setAddingTo(addingTo === zone.id ? null : zone.id); setAddUrl(''); }}
                    className="text-xs px-3 py-1.5 rounded-lg text-brand-600 bg-brand-50 hover:bg-brand-100 font-medium transition-colors"
                  >
                    + URL
                  </button>
                  <button
                    onClick={() => deleteZone(zone.id)}
                    className="text-xs px-3 py-1.5 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 font-medium transition-colors"
                  >
                    {labels.deleteCategory}
                  </button>
                </div>
              </div>

              {/* Add URL inline form */}
              {addingTo === zone.id && (
                <div className="flex items-center gap-2 px-6 py-3 bg-surface-50 border-b border-surface-100">
                  <input
                    type="text"
                    value={addUrl}
                    onChange={e => setAddUrl(e.target.value)}
                    placeholder={labels.addUrlPlaceholder}
                    onKeyDown={e => e.key === 'Enter' && addUrlToZone(zone.id)}
                    className="flex-1 px-3 py-2 bg-white border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-all"
                    autoFocus
                  />
                  <button
                    onClick={() => addUrlToZone(zone.id)}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold transition-colors"
                  >
                    {labels.addUrl}
                  </button>
                </div>
              )}

              {/* URL chips */}
              <div className="px-6 py-4">
                <div className="flex flex-wrap gap-2">
                  {zone.patterns.map(p => (
                    <span key={p} className="inline-flex items-center gap-1.5 text-xs font-mono bg-surface-50 border border-surface-200 text-gray-600 px-3 py-1.5 rounded-lg group">
                      {p}
                      <button
                        onClick={() => removeUrlFromZone(zone.id, p)}
                        className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        title={lang === 'es' ? 'Quitar' : 'Remove'}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
