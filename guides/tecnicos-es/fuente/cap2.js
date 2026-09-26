/* Capturas parte 2: Recurring, History, Gallery (empleado), supervisor, ESP. */
const { launch, phone, BASE } = require('./lib');
const wait = ms => new Promise(r => setTimeout(r, ms));
function watch(p) {
  p.on('pageerror', e => console.log('PAGEERR', p.url(), e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|40[14]/.test(m.text())) console.log('CONSOLE', m.text()); });
  p.on('dialog', async d => { console.log('DIALOG', d.message()); await d.accept(); });
}
async function unstick(p, keepToast) {
  await p.evaluate(k => {
    document.querySelectorAll('body *').forEach(el => { if (getComputedStyle(el).position === 'sticky') el.style.position = 'relative'; });
    const t = document.getElementById('toast'); if (t && !k) { t.style.transition = 'none'; t.style.opacity = '0'; }
  }, !!keepToast);
}
async function shotEl(p, sel, file) {
  await unstick(p);
  const el = p.locator(sel).first(); await el.scrollIntoViewIfNeeded(); await wait(150);
  await el.screenshot({ path: 'shots/' + file + '.png' });
}
const tab = async (p, v) => { await p.click(`[data-view="${v}"]`); await wait(700); };
const openCard = async (p, id) => { await p.locator(`.order-card[data-order="${id}"] .order-head`).click(); await wait(400); };
(async () => {
  const b = await launch();
  let ctx = await phone(b, { who: 'emp' }); let p = await ctx.newPage(); watch(p);
  await p.goto(BASE + 'employee.html', { waitUntil: 'networkidle' }); await wait(800);
  await p.fill('#active-search', 'river'); await wait(200);
  await p.screenshot({ path: 'shots/b04-search.png', clip: { x: 0, y: 0, width: 390, height: 470 } });

  // --- Recurring (empleado) ---
  await tab(p, 'recurring');
  await p.screenshot({ path: 'shots/d01-recurring.png' });
  await p.locator('.recurring-card .order-head').nth(0).click(); await wait(700);
  await shotEl(p, '.recurring-card >> nth=0', 'd02-recurring-today');
  await p.click('.recurring-card >> nth=0 >> .recurring-mark-done'); await wait(400);
  await unstick(p, true);
  await p.locator('.recurring-card').nth(0).scrollIntoViewIfNeeded();
  await p.screenshot({ path: 'shots/d03-recurring-marked.png' });
  await p.locator('.recurring-card .order-head').nth(0).click(); await wait(200);
  await p.locator('.recurring-card .order-head').nth(2).click(); await wait(700);
  await shotEl(p, '.recurring-card >> nth=2', 'd04-recurring-notdue');

  // --- History ---
  await p.goto(BASE + 'employee.html', { waitUntil: 'networkidle' }); await wait(600);
  await tab(p, 'history'); await wait(500);
  await p.screenshot({ path: 'shots/e01-history.png' });
  await openCard(p, 'GS-10431'); await shotEl(p, '#history-list .order-card[data-order="GS-10431"]', 'e02-history-open');

  // --- Gallery / Docs ---
  await p.goto(BASE + 'employee.html', { waitUntil: 'networkidle' }); await wait(600);
  await tab(p, 'gallery'); await wait(1200);
  await p.screenshot({ path: 'shots/f01-gallery.png' });
  await p.screenshot({ path: 'shots/f01b-gallery-full.png', fullPage: true });
  await p.locator('#gallery-list >> text=Maple Ridge Apartments').first().click(); await wait(800);
  await shotEl(p, '.gs-gal-grp >> nth=0', 'f01c-gallery-open');
  await p.locator('#gallery-list img:visible').first().click(); await wait(800);
  await p.screenshot({ path: 'shots/f02-lightbox.png' });
  await p.keyboard.press('Escape'); await wait(300);
  await p.goto(BASE + 'employee.html', { waitUntil: 'networkidle' }); await wait(600);
  await tab(p, 'gallery'); await wait(1000);
  await p.locator('#gallery-list >> text=Pine Valley Apartments').first().click(); await wait(800);
  await shotEl(p, '.gs-gal-grp >> nth=2', 'f01d-gallery-inspection');
  await p.goto(BASE + 'employee.html', { waitUntil: 'networkidle' }); await wait(600);
  await tab(p, 'gallery'); await wait(1000);
  await p.click('.gal-subtab[data-galsub="docs"]'); await wait(400);
  await p.screenshot({ path: 'shots/f03-docs.png' });
  await p.locator('#docs-list >> text=Maple Ridge Apartments').first().click(); await wait(600);
  await unstick(p);
  await p.screenshot({ path: 'shots/f03b-docs-open.png' });
  await p.locator('#docs-list >> text=Scope of work.pdf').first().click(); await wait(1500);
  await p.screenshot({ path: 'shots/f04-doc-view.png' });
  await ctx.close();

  // --- ESP ---
  ctx = await phone(b, { who: 'emp', lang: 'es' }); p = await ctx.newPage(); watch(p);
  await p.goto(BASE + 'employee.html', { waitUntil: 'networkidle' }); await wait(1000);
  await p.screenshot({ path: 'shots/g01-esp-active.png' });
  await openCard(p, 'GS-10482'); await shotEl(p, '.order-card[data-order="GS-10482"]', 'g02-esp-order');
  await ctx.close();

  // --- Supervisor ---
  ctx = await phone(b, { who: 'sup' }); p = await ctx.newPage(); watch(p);
  await p.goto(BASE + 'supervisor.html', { waitUntil: 'networkidle' }); await wait(900);
  await p.screenshot({ path: 'shots/h01-sup-active.png' });
  await p.click('#active-division-pills .pill[data-division="Janitorial"]'); await wait(300);
  await p.screenshot({ path: 'shots/h02-sup-pills.png', clip: { x: 0, y: 0, width: 390, height: 620 } });
  await p.click('#active-division-pills .pill[data-division=""]'); await wait(300);
  // Inspeccion
  await openCard(p, 'GS-10501'); await shotEl(p, '.order-card[data-order="GS-10501"]', 'h03-inspection');
  await p.fill('.order-card[data-order="GS-10501"] .insp-notes', 'Carpet in both bedrooms is torn near the closet. Living room walls have nail holes and a water stain by the window.');
  await p.dispatchEvent('.order-card[data-order="GS-10501"] .insp-notes', 'input');
  await p.locator('.order-card[data-order="GS-10501"] .crew-chip', { hasText: 'Carlos Ramírez' }).click();
  await p.locator('.order-card[data-order="GS-10501"] .crew-chip', { hasText: 'Ana López' }).click();
  await wait(200);
  await shotEl(p, '.order-card[data-order="GS-10501"]', 'h04-inspection-filled');
  // Update services dentro de inspeccion -> guardar
  await p.click('.order-card[data-order="GS-10501"] >> text=Update Services'); await wait(900);
  await p.locator('#editpanel-GS-10501 .um-add-search').fill('caulk'); await wait(300);
  await p.locator('#editpanel-GS-10501 .um-add-chip').first().click(); await wait(300);
  await p.click('#um-submit-btn'); await wait(500);
  await shotEl(p, '.order-card[data-order="GS-10501"]', 'h05-inspection-saved');
  await p.click('#insp-done-GS-10501'); await wait(600);
  await unstick(p, true);
  await p.screenshot({ path: 'shots/h06-inspection-sent.png' });

  // Orden normal
  await p.goto(BASE + 'supervisor.html', { waitUntil: 'networkidle' }); await wait(900);
  await openCard(p, 'GS-10482'); await shotEl(p, '.order-card[data-order="GS-10482"]', 'h07-sup-order');
  await p.click('.order-card[data-order="GS-10482"] >> text=Update Services'); await wait(900);
  await shotEl(p, '#editpanel-GS-10482', 'h08-update-panel');
  // Quitar con nota
  await p.locator('#editpanel-GS-10482 .um-remove-btn').nth(2).click(); await wait(300);
  await p.fill('#um-note-input-2', 'The kitchen was already cleaned by the property.');
  await shotEl(p, '#editpanel-GS-10482', 'h09-remove-note');
  await p.click('#editpanel-GS-10482 .um-note-confirm'); await wait(300);
  // Nivel y cantidad
  await p.locator('#editpanel-GS-10482 .lvl-btn').first().click().catch(() => {});
  await p.locator('#editpanel-GS-10482 .um-qty-input').first().fill('3').catch(() => {});
  await p.locator('#editpanel-GS-10482 .um-qty-input').first().dispatchEvent('change').catch(() => {});
  // Agregar del catalogo
  await p.locator('#editpanel-GS-10482 .um-add-search').fill('outlet'); await wait(300);
  await shotEl(p, '#editpanel-GS-10482', 'h10-add-search');
  await p.locator('#editpanel-GS-10482 .um-add-chip').first().click(); await wait(300);
  await shotEl(p, '#editpanel-GS-10482', 'h11-panel-ready');
  await p.click('#um-submit-btn'); await wait(600);
  await unstick(p, true);
  await p.screenshot({ path: 'shots/h12-update-sent.png' });

  // Por servicio (agrupado por persona)
  await p.goto(BASE + 'supervisor.html', { waitUntil: 'networkidle' }); await wait(900);
  await openCard(p, 'GS-10490'); await shotEl(p, '.order-card[data-order="GS-10490"]', 'h13-sup-by-person');
  // Orden de otro supervisor (sin Mark as Done)
  await openCard(p, 'GS-10490');
  await openCard(p, 'GS-10486'); await shotEl(p, '.order-card[data-order="GS-10486"]', 'h14-sup-other');

  // Recurring supervisor + Update Services
  await tab(p, 'recurring');
  await p.locator('.recurring-card .order-head').first().click(); await wait(700);
  await shotEl(p, '.recurring-card >> nth=0', 'h15-sup-recurring');
  await p.click('#rc-update-btn-RS-31'); await wait(1500);
  await shotEl(p, '#rc-update-wrap-RS-31', 'h16-rc-update');
  await p.locator('#rc-update-wrap-RS-31 .gs-sp-area-head', { hasText: 'Kitchen & Breakroom' }).click(); await wait(500);
  await shotEl(p, '#rc-update-wrap-RS-31', 'h17-rc-update-added');
  await ctx.close();
  await b.close();
  console.log('done');
})();
