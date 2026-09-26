/* ============================================================
   tech-photos.js -- lo mismo en supervisor.html y employee.html
   (26/09/2026, pedido del dueño):

   1) TechReturn: "al tomar una foto y dar Done te debe regresar al
      mismo lugar donde estabas antes de abrir la camara". La camara es
      otra pagina (camera-capture.html), asi que al volver la pagina se
      carga de nuevo arriba y con todo cerrado. Antes de salir se guarda
      la pestana, las tarjetas abiertas y hasta donde se habia bajado;
      al volver se deja igual.

   2) TechPhotos: "mostrar un pequeño thumbnail de la foto que se
      tomo, algo asi como se ve la parte de los documentos". Una tira
      chiquita por orden (ultimas fotos + "+N") y la miniatura de la
      ultima foto junto a la camarita de cada servicio. Las fotos que
      todavia estan en la cola del telefono (GSCameraQueue) salen al
      instante, aunque no haya señal, con una marca de "subiendo"; las
      ya subidas vienen de get-my-gallery (solo de estas ordenes). Al
      tocar una se abre en grande (GSLightbox) con las de esa orden.
============================================================ */
(function () {
  'use strict';

  var RETURN_KEY = 'tech_return_state';

  function orderKeyOf(body) {
    var card = body.closest('.order-card');
    if (!card) return null;
    if (card.dataset.order) return 'o:' + card.dataset.order;
    return card.dataset.rc ? 'r:' + card.dataset.rc : null;
  }

  var TechReturn = {
    save: function () {
      try {
        var tab = document.querySelector('.view.active');
        var open = [];
        document.querySelectorAll('.order-card .order-body.open').forEach(function (b) {
          var k = orderKeyOf(b); if (k) open.push(k);
        });
        sessionStorage.setItem(RETURN_KEY, JSON.stringify({
          view: tab ? tab.id.replace(/^view-/, '') : '', open: open, y: window.scrollY || 0, at: Date.now()
        }));
      } catch (e) { /* sin sessionStorage: se regresa arriba, como antes */ }
    },
    /* showTab: la funcion de la pagina. Se llama despues de pintar las
       tarjetas (loadOrders). Solo sirve una vez y solo si es reciente. */
    restore: function (showTab) {
      var st = null;
      try { st = JSON.parse(sessionStorage.getItem(RETURN_KEY) || 'null'); sessionStorage.removeItem(RETURN_KEY); } catch (e) { st = null; }
      if (!st || Date.now() - (st.at || 0) > 30 * 60000) return false;
      if (st.view && st.view !== 'active' && typeof showTab === 'function' && document.getElementById('view-' + st.view)) showTab(st.view);
      (st.open || []).forEach(function (k) {
        var id = k.slice(2).replace(/"/g, '');
        var card = document.querySelector(k.indexOf('o:') === 0 ? '.order-card[data-order="' + id + '"]' : '.order-card[data-rc="' + id + '"]');
        var body = card && card.querySelector('.order-body');
        if (!body || body.classList.contains('open')) return;
        /* Recurring: su propio toggle, que tambien carga su historial. */
        var head = card.querySelector('.order-head');
        if (k.indexOf('r:') === 0 && head && typeof window.toggleRecurringCard === 'function') window.toggleRecurringCard(head, id);
        else body.classList.add('open');
      });
      /* Dos veces: la segunda, cuando ya cargaron fotos/fuentes y la
         pagina tiene su alto real. */
      var y = st.y || 0;
      window.scrollTo(0, y);
      setTimeout(function () { window.scrollTo(0, y); }, 350);
      return true;
    }
  };

  /* ---------------- miniaturas ---------------- */
  var server = {};      // orderId -> [{downloadUrl, name, serviceName, sortKey}]
  var pending = [];     // [{id, orderId, serviceName, src, failed}]
  var recent = {};      // id -> item ya subido, mientras llega del servidor
  var loadedFor = {};   // orderId -> true (ya se pidio al servidor)
  var cfg = null;
  var MAX_STRIP = 4;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function jsq(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

  function styleTag() {
    if (document.getElementById('tech-photos-style')) return;
    var s = document.createElement('style');
    s.id = 'tech-photos-style';
    s.textContent =
      '.tp-strip{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:10px}' +
      '.tp-strip:empty{display:none}' +
      '.tp-th{position:relative;width:40px;height:40px;border-radius:4px;overflow:hidden;border:1px solid var(--border,#E0DDD6);padding:0;background:#EFEDE7;cursor:pointer;flex-shrink:0}' +
      '.tp-th img{width:100%;height:100%;object-fit:cover;display:block}' +
      '.tp-th.up img{opacity:.55}' +
      '.tp-th .tp-mk{position:absolute;right:1px;bottom:1px;font-size:9px;line-height:1;background:rgba(255,255,255,.9);border-radius:3px;padding:1px 2px}' +
      '.tp-more{font-size:11px;font-weight:700;color:var(--gold-dk,#8C6F2A)}' +
      '.tp-svc{display:inline-flex;align-items:center;margin-right:6px;flex-shrink:0}' +
      '.tp-svc:empty{display:none}' +
      '.tp-svc .tp-th{width:30px;height:30px}' +
      '.tp-cnt{position:absolute;left:1px;top:1px;font-size:9px;font-weight:700;line-height:1;background:var(--gold,#C9A84C);color:#111;border-radius:3px;padding:1px 3px}';
    document.head.appendChild(s);
  }

  function srcOf(b64) {
    var v = String(b64 || '');
    return v.indexOf('data:') === 0 ? v : 'data:image/jpeg;base64,' + v;
  }

  /* Todas las fotos de una orden, la mas nueva primero: las de la cola
     del telefono primero (son las que se acaban de tomar). */
  function photosOf(orderId, serviceName) {
    var mine = pending.filter(function (p) { return p.orderId === orderId; })
      .concat(Object.keys(recent).map(function (k) { return recent[k]; }).filter(function (p) { return p.orderId === orderId; }))
      .map(function (p) { return { downloadUrl: p.src, name: 'Photo', serviceName: p.serviceName || null, _up: !p.done, _failed: p.failed }; });
    var up = (server[orderId] || []).slice().sort(function (a, b) { return String(b.sortKey || '').localeCompare(String(a.sortKey || '')); });
    var all = mine.concat(up);
    if (serviceName != null) all = all.filter(function (p) { return p.serviceName === serviceName; });
    return all;
  }

  function thumbHtml(p, onclick, extra) {
    var mk = p._failed ? '<span class="tp-mk" title="Could not upload yet">⚠️</span>'
      : (p._up ? '<span class="tp-mk" title="Uploading">⏳</span>' : '');
    return '<button type="button" class="tp-th' + (p._up ? ' up' : '') + '" onclick="event.stopPropagation();' + onclick + '">' +
      '<img src="' + esc(p.downloadUrl) + '" alt="" loading="lazy">' + mk + (extra || '') + '</button>';
  }

  function stripHtml(orderId) {
    var all = photosOf(orderId);
    if (!all.length) return '';
    var shown = all.slice(0, MAX_STRIP);
    var more = all.length - shown.length;
    return shown.map(function (p, i) {
      return thumbHtml(p, "TechPhotos.open('" + jsq(orderId) + "'," + i + ")");
    }).join('') + (more > 0 ? '<span class="tp-more">+' + more + '</span>' : '');
  }

  function svcHtml(orderId, serviceName) {
    var all = photosOf(orderId, serviceName);
    if (!all.length) return '';
    var cnt = all.length > 1 ? '<span class="tp-cnt">' + all.length + '</span>' : '';
    return thumbHtml(all[0], "TechPhotos.open('" + jsq(orderId) + "',0,'" + jsq(serviceName) + "')", cnt);
  }

  /* Contenedores que pintan las paginas:
       <div class="tp-strip" data-tp-order="GS-1"></div>
       <span class="tp-svc" data-tp-order="GS-1" data-tp-svc="Carpet"></span> */
  function paint() {
    styleTag();
    document.querySelectorAll('.tp-strip[data-tp-order]').forEach(function (el) {
      el.innerHTML = stripHtml(el.getAttribute('data-tp-order'));
    });
    document.querySelectorAll('.tp-svc[data-tp-order]').forEach(function (el) {
      el.innerHTML = svcHtml(el.getAttribute('data-tp-order'), el.getAttribute('data-tp-svc'));
    });
  }

  function open(orderId, index, serviceName) {
    if (!window.GSLightbox) return;
    var list = photosOf(orderId, serviceName == null ? undefined : serviceName);
    window.GSLightbox.open(list, index || 0);
  }

  /* orderIds: las ordenes de la pantalla. Solo se piden las que no se
     han pedido (force = volver a pedir esas). */
  function load(orderIds, force) {
    if (!cfg) return Promise.resolve();
    var ids = (orderIds || []).filter(function (id) { return id && (force || !loadedFor[id]); });
    if (!ids.length) { paint(); return Promise.resolve(); }
    ids.forEach(function (id) { loadedFor[id] = true; });
    return cfg.api('/get-my-gallery', { body: Object.assign({ orderIds: ids, photosOnly: true }, cfg.who()) })
      .then(function (res) {
        ids.forEach(function (id) { server[id] = []; });
        (res.groups || []).forEach(function (g) { server[g.orderId] = g.photos || []; });
        /* Lo que ya se subio y ya llego del servidor deja de ser "reciente". */
        Object.keys(recent).forEach(function (k) { if (ids.indexOf(recent[k].orderId) !== -1) delete recent[k]; });
        paint();
      })
      .catch(function () { ids.forEach(function (id) { delete loadedFor[id]; }); paint(); });
  }

  var reloadTimer = null, reloadIds = {};
  /* Se llama desde el onChange de GSCameraQueue de cada pagina. */
  function onQueue(items) {
    var now = (items || []).filter(function (it) { return it && it.body && it.body.orderId; }).map(function (it) {
      return { id: it.id, orderId: String(it.body.orderId), serviceName: it.body.serviceName || null, src: srcOf(it.body.imageBase64), failed: !!it.failed };
    });
    /* Lo que se fue de la cola ya subio: se deja visible hasta que el
       servidor lo regrese, y se le vuelve a pedir esa orden. */
    pending.forEach(function (p) {
      if (!now.some(function (n) { return n.id === p.id; })) {
        recent[p.id] = Object.assign({}, p, { done: true });
        reloadIds[p.orderId] = true;
      }
    });
    pending = now;
    paint();
    var ids = Object.keys(reloadIds);
    if (ids.length) {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(function () { reloadIds = {}; load(ids, true); }, 1500);
    }
  }

  function init(opts) { cfg = opts; styleTag(); }
  function count(orderId) { return photosOf(orderId).length; }
  function pendingFor(orderId) { return pending.filter(function (p) { return p.orderId === orderId; }).length; }

  /* ---------------- "Mark my part done" por dia ----------------
     (26/09/2026, pedido del dueño): en una orden por servicio cada
     persona ve solo lo suyo y tiene UN boton por dia ("cada dia es una
     orden") que marca todos sus servicios de ese dia. Basta con al
     menos una foto o video de la orden. La orden se queda en Tech
     ("waiting on office") hasta que la oficina cierre toda la orden. */
  var dayCfg = null;
  function fmtDay(day) {
    var d = new Date(String(day).slice(0, 10) + 'T12:00:00');
    return isNaN(d.getTime()) ? String(day) : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  /* Grupos por dia de UNA persona: [{day, rows, done, pending}] */
  function dayGroups(rows) {
    var by = {}, order = [];
    (rows || []).forEach(function (a) {
      var d = String(a.ScheduledDate || '').slice(0, 10);
      if (!by[d]) { by[d] = []; order.push(d); }
      by[d].push(a);
    });
    order.sort(function (x, y) { return (x ? 0 : 1) - (y ? 0 : 1) || x.localeCompare(y); });
    return order.map(function (d) {
      var st = by[d].map(function (a) { return a.WorkStatus || 'Not Started'; });
      var done = st.every(function (x) { return x === 'Completed'; });
      var pend = !done && st.every(function (x) { return x === 'Completed' || x === 'Pending Review'; });
      return { day: d, rows: by[d], done: done, pending: pend };
    });
  }
  /* Pie de cada dia: el boton, o en que va. */
  function dayFooterHtml(o, g, several) {
    if (!g.day) return '';
    if (g.done) return '<p class="tech-done-note" style="background:#EAF3EC;color:#3E7A4C;border-color:#CFE5D5">✓ Completed</p>';
    if (g.pending) return '<p class="tech-done-note">✓ You marked your part as done — waiting for the office to confirm.</p>';
    if (o.Waiting) return '';
    return '<button type="button" class="gs-ofp-btn-primary" style="margin-top:10px" onclick="event.stopPropagation();TechDayDone.start(\'' + jsq(o.OrderID) + '\',\'' + jsq(g.day) + '\')"><span>✓ Mark my part done</span>' +
      (several ? '<span> · ' + esc(fmtDay(g.day)) + '</span>' : '') + '</button>';
  }
  function waitUploads(orderId, ms) {
    var until = Date.now() + ms;
    return new Promise(function (resolve) {
      (function tick() {
        if (!pendingFor(orderId)) return resolve(true);
        if (Date.now() > until) return resolve(false);
        setTimeout(tick, 1500);
      })();
    });
  }
  var TechDayDone = {
    init: function (opts) { dayCfg = opts; },
    fmtDay: fmtDay, groups: dayGroups, footerHtml: dayFooterHtml,
    start: function (orderId, day) {
      if (!dayCfg) return;
      if (count(orderId) > 0) {
        if (!window.confirm('Mark your part of this order as done for ' + fmtDay(day) + '? The office will confirm it.')) return;
        TechDayDone.finish(orderId, day);
        return;
      }
      /* Sin ninguna foto/video todavia: a la camara, y al volver se marca. */
      TechReturn.save();
      location.href = 'camera-capture.html?context=order-photo&orderId=' + encodeURIComponent(orderId) +
        '&return=' + encodeURIComponent(dayCfg.page) + '&requireAtLeastOne=1&completeAfter=1&completeDay=' + encodeURIComponent(day) +
        '&label=' + encodeURIComponent('Order ' + orderId);
    },
    finish: function (orderId, day) {
      if (!dayCfg) return Promise.resolve();
      var go = function () {
        return dayCfg.api('/submit-service-complete', { body: { orderId: orderId, techId: dayCfg.techId(), dayMode: true, day: day } })
          .then(function () {
            dayCfg.toast('Your part for ' + fmtDay(day) + ' is marked as done — the office will confirm.');
            TechReturn.save();
            return Promise.resolve(dayCfg.reload()).then(function () { TechReturn.restore(dayCfg.showTab); });
          })
          .catch(function (e) { dayCfg.toast('Could not mark your part done: ' + e.message); });
      };
      /* La foto recien tomada puede seguir subiendo: se espera a que
         suba antes de avisarle al servidor (el revisa que exista). */
      if (!pendingFor(orderId)) return go();
      dayCfg.toast('Uploading your photo…');
      return waitUploads(orderId, 45000).then(function (ok) {
        if (ok) return go();
        dayCfg.toast('Your photo is still uploading. Tap "Mark my part done" again when it finishes.');
      });
    }
  };

  window.TechReturn = TechReturn;
  window.TechDayDone = TechDayDone;
  window.TechPhotos = { init: init, load: load, paint: paint, onQueue: onQueue, open: open, stripHtml: stripHtml, svcHtml: svcHtml, count: count };
})();
