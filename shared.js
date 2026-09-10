/* ============================================================
   shared.js — funciones compartidas del portal tech.gsocd.com
   - GS.session : sesion del empleado/supervisor en sessionStorage
   - GS.api     : wrapper de llamadas a las funciones del backend
   - GS.applyLogo : logo del nav, mismo archivo que usan admin/orders
============================================================ */

const GS = {
  session: {
    KEY: 'gs_tech',
    get() { try { return JSON.parse(sessionStorage.getItem(this.KEY)); } catch (e) { return null; } },
    set(t) { sessionStorage.setItem(this.KEY, JSON.stringify(t)); },
    clear() { sessionStorage.removeItem(this.KEY); }
  },

  /* Guard para paginas internas: sin sesion -> login.
     roleNeeded (opcional): si se da, ademas exige que el rol de la
     sesion coincida -- para que un Employee no pueda entrar a mano a
     la URL de supervisor.html y viceversa. */
  requireSession(roleNeeded) {
    const t = GS.session.get();
    if (!t) { location.replace('index.html'); return null; }
    if (roleNeeded && t.role !== roleNeeded) { location.replace('index.html'); return null; }
    return t;
  },

  async api(path, opts = {}) {
    const res = await fetch('/api' + path, {
      method: opts.method || 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* body no-JSON */ }
    if (!res.ok) {
      const err = new Error(data.error || ('Request failed (' + res.status + ')'));
      if (data.debug) err.debug = data.debug;
      throw err;
    }
    return data;
  },

  /* Logo del nav: mismo archivo (Logo.jpg) que ya usan admin.html y el
     portal del cliente -- todos leen de la raiz del mismo SharePoint. */
  async applyLogo() {
    const img = document.querySelector('.logo-diamond');
    if (!img) return;
    const FALLBACK = 'data:image/svg+xml;utf8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">' +
      '<rect width="120" height="120" fill="#EFEDE7" stroke="#E0D9CC"/>' +
      '<text x="60" y="68" font-family="Georgia, serif" font-size="20" fill="#8C6F2A" text-anchor="middle">LOGO</text></svg>'
    );
    try {
      const res = await fetch('/api/site-image?name=' + encodeURIComponent('Logo.jpg'));
      img.src = res.ok ? URL.createObjectURL(await res.blob()) : FALLBACK;
    } catch (e) {
      img.src = FALLBACK;
    }
  },

  /* Llave publica VAPID -- segura de exponer (solo la privada, del
     lado de Admingsocd.com que manda los pushes, debe mantenerse
     secreta). Pide permiso de notificaciones y suscribe a este
     navegador/dispositivo, guardando la suscripcion en SharePoint via
     save-push-subscription.js. Se llama una vez, justo despues de
     iniciar sesion (employee.html/supervisor.html) -- si el navegador
     no soporta push, o el usuario ya dijo que no antes, no hace nada
     ni molesta de nuevo. */
  VAPID_PUBLIC_KEY: 'BI1jC4_r9hiZyvkQAl6Kyj8Lh2TQPxCxy8APpYF08PmSG-XKGs79wv4xDNUGfrNBCLyMppFLhETkedHERiXOPJw',

  async initPushNotifications(techId) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission === 'denied') return;

    try {
      if (Notification.permission === 'default') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') return;
      }
      if (Notification.permission !== 'granted') return;

      const reg = await navigator.serviceWorker.register('/sw.js');
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const key = GS.VAPID_PUBLIC_KEY.replace(/-/g, '+').replace(/_/g, '/');
        const padded = key + '='.repeat((4 - key.length % 4) % 4);
        const raw = atob(padded);
        const appServerKey = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) appServerKey[i] = raw.charCodeAt(i);
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appServerKey });
      }
      await GS.api('/save-push-subscription', { body: { techId, subscription: sub.toJSON() } });
    } catch (e) {
      /* Nunca debe tumbar el login por esto -- si algo falla (usuario
         cerro el prompt, navegador raro, etc.), simplemente no hay
         notificaciones para este dispositivo, sin ningun aviso feo. */
    }
  }
};

/* Logo automatico en cualquier pagina que no sea el login */
if (!location.pathname.toLowerCase().endsWith('index.html') && location.pathname !== '/' && !location.pathname.toLowerCase().endsWith('/')) {
  document.addEventListener('DOMContentLoaded', () => GS.applyLogo());
}
