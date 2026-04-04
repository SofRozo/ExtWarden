/**
 * Content Script — ExtWarden
 * Inyecta una alerta visible cuando el Service Worker detecta una extensión
 * riesgosa en una zona de control contextual.
 */

const OVERLAY_ID = 'cabc-alert-overlay';

function sanitize(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showAlert(data: {
  extension: { id: string; name: string };
  zone: { id: string; category: string; pattern: string };
}): void {
  if (document.getElementById(OVERLAY_ID)) return;

  const container = document.createElement('div');
  container.id = OVERLAY_ID;
  container.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;
    max-width: 380px;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    transition: opacity 0.3s ease, transform 0.3s ease;
    opacity: 0; transform: translateY(16px);
  `;

  container.innerHTML = `
    <div style="
      background: white; border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08);
      padding: 20px; border-left: 4px solid #EF4444;
    ">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <div style="
          width:36px;height:36px;border-radius:10px;
          background:#FEF2F2;display:flex;align-items:center;justify-content:center;flex-shrink:0
        ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <div style="flex:1">
          <p style="font-size:14px;font-weight:600;color:#1f2937;margin:0">Bloqueo de Seguridad</p>
        </div>
        <button id="cabc-dismiss" style="
          background:none;border:none;cursor:pointer;padding:4px;color:#9ca3af;
          display:flex;align-items:center;justify-content:center
        ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <p style="font-size:13px;color:#6b7280;line-height:1.5;margin:0 0 16px">
        Se impidió la ejecución de
        <strong style="color:#1f2937">${sanitize(data.extension.name)}</strong>
        en este sitio (${sanitize(data.zone.category)}).
      </p>
      <button id="cabc-ok" style="
        width:100%;padding:10px;font-size:13px;font-weight:600;
        color:white;background:#7c3aed;border:none;border-radius:10px;
        cursor:pointer;transition:background 0.2s
      ">
        Entendido
      </button>
    </div>
  `;

  document.body.appendChild(container);

  // Animate in
  requestAnimationFrame(() => {
    container.style.opacity = '1';
    container.style.transform = 'translateY(0)';
  });

  const dismiss = () => {
    container.style.opacity = '0';
    container.style.transform = 'translateY(16px)';
    setTimeout(() => container.remove(), 300);
  };

  container.querySelector('#cabc-dismiss')?.addEventListener('click', dismiss);
  container.querySelector('#cabc-ok')?.addEventListener('click', dismiss);

  // Auto-dismiss after 12 seconds
  setTimeout(dismiss, 12000);
}

chrome.runtime.onMessage.addListener(message => {
  if (message.action === 'showAlert') {
    showAlert(message as Parameters<typeof showAlert>[0]);
  }
});

console.log('[ExtWarden] Content script loaded on', window.location.hostname);
