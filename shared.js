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
    /* 25/09/2026: sin sesion firmada (cookie) el servidor contesta 401.
       De regreso a index.html, que vuelve a validar el dispositivo (QR) y
       renueva la cookie sola -- el tecnico casi nunca lo nota. */
    if (res.status === 401 && data && data.signin) {
      GS.session.clear();
      if (!/index\.html$|\/$/.test(location.pathname)) location.replace('index.html');
    }
    if (!res.ok) {
      const err = new Error(data.error || ('Request failed (' + res.status + ')'));
      err.status = res.status;
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
     secreta). */
  VAPID_PUBLIC_KEY: 'BI1jC4_r9hiZyvkQAl6Kyj8Lh2TQPxCxy8APpYF08PmSG-XKGs79wv4xDNUGfrNBCLyMppFLhETkedHERiXOPJw',

  /* Avisos push (rehecho 25/09/2026, pedido del dueño). El tecnico NO
     tiene opcion de prenderlos o apagarlos: el permiso se da una sola
     vez al configurar el telefono en la oficina (device-setup.html,
     QR de "Set Up Phone" en Admin), junto con lo demas. Aqui solo:
       - pushState(): 'on' | 'off' | 'denied' | 'ios-install' | 'unsupported'
       - subscribePush(techId): suscribe este telefono y lo guarda.
       - initPushNotifications(techId): al entrar al portal, si ya hay
         permiso, renueva la suscripcion en silencio (nunca pregunta). */
  isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  },
  isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  },
  pushState() {
    const hasApi = ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);
    if (GS.isIOS() && !GS.isStandalone()) return 'ios-install';
    if (!hasApi) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    return Notification.permission === 'granted' ? 'on' : 'off';
  },

  async subscribePush(techId) {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
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
    return true;
  },

  /* Al entrar: solo renueva si ya hay permiso. Nunca pregunta. */
  async initPushNotifications(techId) {
    try { if (GS.pushState() === 'on') await GS.subscribePush(techId); } catch (e) { /* sin avisos en este telefono */ }
  },
};

/* Logo automatico en cualquier pagina que no sea el login */
if (!location.pathname.toLowerCase().endsWith('index.html') && location.pathname !== '/' && !location.pathname.toLowerCase().endsWith('/')) {
  document.addEventListener('DOMContentLoaded', () => GS.applyLogo());
}
