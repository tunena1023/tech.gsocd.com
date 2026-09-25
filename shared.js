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

  /* Avisos push (rehecho 25/09/2026, pedido del dueño: "los tecnicos
     no ven emails... quiero push notificaciones para ellos", Android
     y iPhone). Antes se pedia el permiso solo al entrar: iPhone y
     Chrome lo ignoran si no viene de un toque, y en iPhone ademas el
     push solo existe si la app se agrego a la pantalla de inicio.
     Ahora:
       - pushState(): 'on' | 'off' | 'denied' | 'ios-install' | 'unsupported'
       - initPushNotifications(techId): al entrar, si ya habia permiso,
         renueva la suscripcion en silencio (no pregunta nada).
       - enablePush(techId): lo llama el boton (un toque) -> permiso +
         suscripcion + se guarda en SharePoint.
       - mountPushBanner(afterEl, techId): la tarjeta "Turn on job
         alerts" (o los pasos de iPhone) hasta que queden prendidos. */
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

  /* Desde el boton. Devuelve el estado final. */
  async enablePush(techId) {
    if (GS.pushState() !== 'off' && GS.pushState() !== 'on') return GS.pushState();
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return GS.pushState();
    await GS.subscribePush(techId);
    return 'on';
  },

  mountPushBanner(afterEl, techId) {
    if (!afterEl || document.getElementById('push-banner')) return;
    const state = GS.pushState();
    if (state === 'on' || state === 'unsupported') return;
    let snooze = 0;
    try { snooze = Number(localStorage.getItem('gs_push_snooze') || 0); } catch (e) {}
    if (snooze > Date.now()) return;

    if (!document.getElementById('push-banner-style')) {
      const st = document.createElement('style');
      st.id = 'push-banner-style';
      st.textContent = '#push-banner{display:flex;gap:12px;align-items:flex-start;margin:0 0 16px;padding:14px;border:1px solid var(--border,#E0D9CC);border-left:3px solid var(--gold,#C9A84C);border-radius:8px;background:var(--off,#F7F6F3);font-size:13px;line-height:1.45;color:var(--black,#111)}' +
        '#push-banner .pb-ic{font-size:20px;line-height:1}' +
        '#push-banner .pb-main{flex:1;min-width:0}' +
        '#push-banner b{display:block;font-size:14px;margin-bottom:2px}' +
        '#push-banner ol{margin:6px 0 0;padding-left:18px}#push-banner li{margin:3px 0}' +
        '#push-banner .pb-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}' +
        '#push-banner button{font:600 12px/1 Inter,sans-serif;letter-spacing:.04em;padding:10px 14px;border-radius:6px;cursor:pointer;min-height:40px}' +
        '#push-banner .pb-on{background:var(--gold,#C9A84C);color:#fff;border:0}' +
        '#push-banner .pb-later{background:transparent;color:var(--gray,#6B6B6B);border:1px solid var(--border,#E0D9CC)}' +
        '#push-banner .pb-err{color:var(--red,#c0392b);margin-top:6px}';
      document.head.appendChild(st);
    }

    const box = document.createElement('div');
    box.id = 'push-banner';
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', 'Job alerts');
    const later = '<button type="button" class="pb-later">Not now</button>';
    if (state === 'ios-install') {
      box.innerHTML = '<div class="pb-ic" aria-hidden="true">🔔</div><div class="pb-main"><b>Get job alerts on your iPhone</b>' +
        'Alerts only work from the app icon on your home screen:' +
        '<ol><li>Tap the Share button <span aria-hidden="true">(square with an arrow ↑)</span> at the bottom of Safari.</li>' +
        '<li>Tap "Add to Home Screen", then "Add".</li>' +
        '<li>Open GS from the new icon and tap "Turn on alerts".</li></ol>' +
        '<div class="pb-actions">' + later + '</div></div>';
    } else if (state === 'denied') {
      box.innerHTML = '<div class="pb-ic" aria-hidden="true">🔕</div><div class="pb-main"><b>Job alerts are blocked</b>' +
        'Turn on notifications for this app in your phone settings to know when the office assigns, changes or cancels your jobs.' +
        '<div class="pb-actions">' + later + '</div></div>';
    } else {
      box.innerHTML = '<div class="pb-ic" aria-hidden="true">🔔</div><div class="pb-main"><b>Turn on job alerts</b>' +
        'Get a notification when the office assigns, changes or cancels your jobs.' +
        '<div class="pb-actions"><button type="button" class="pb-on">Turn on alerts</button>' + later + '</div>' +
        '<div class="pb-err" hidden></div></div>';
    }
    box.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('button');
      if (!btn) return;
      if (btn.classList.contains('pb-later')) {
        try { localStorage.setItem('gs_push_snooze', String(Date.now() + 3 * 24 * 3600 * 1000)); } catch (e) {}
        box.remove();
        return;
      }
      if (btn.classList.contains('pb-on')) {
        btn.disabled = true;
        const err = box.querySelector('.pb-err');
        try {
          const st = await GS.enablePush(techId);
          if (st === 'on') { box.remove(); if (typeof window.showToast === 'function') window.showToast('Job alerts are on.'); return; }
          box.remove();
          GS.mountPushBanner(afterEl, techId);
        } catch (e) {
          btn.disabled = false;
          if (err) { err.hidden = false; err.textContent = 'Could not turn on alerts: ' + e.message; }
        }
      }
    });
    afterEl.insertAdjacentElement('afterend', box);
  }
};

/* Logo automatico en cualquier pagina que no sea el login */
if (!location.pathname.toLowerCase().endsWith('index.html') && location.pathname !== '/' && !location.pathname.toLowerCase().endsWith('/')) {
  document.addEventListener('DOMContentLoaded', () => GS.applyLogo());
}
