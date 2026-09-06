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
    if (!res.ok) throw new Error(data.error || ('Request failed (' + res.status + ')'));
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
  }
};

/* Logo automatico en cualquier pagina que no sea el login */
if (!location.pathname.toLowerCase().endsWith('index.html') && location.pathname !== '/' && !location.pathname.toLowerCase().endsWith('/')) {
  document.addEventListener('DOMContentLoaded', () => GS.applyLogo());
}
