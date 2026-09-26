/* Capturas parte 1: acceso, empleado (Active Orders), camara. */
const { launch, phone, BASE } = require('./lib');
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const wait = ms => new Promise(r => setTimeout(r, ms));
function watch(p) {
  p.on('pageerror', e => console.log('PAGEERR', p.url(), e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) console.log('CONSOLE', m.text()); });
}
async function unstick(p) {
  await p.evaluate(() => {
    document.querySelectorAll('body *').forEach(el => { const cs = getComputedStyle(el); if (cs.position === 'sticky') el.style.position = 'relative'; });
    const t = document.getElementById('toast'); if (t) { t.style.transition = 'none'; t.style.opacity = '0'; }
  });
}
async function shotCard(p, sel, file) {
  await unstick(p);
  const el = p.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  await el.screenshot({ path: 'shots/' + file + '.png' });
}
async function openCard(p, orderId) {
  await p.locator(`.order-card[data-order="${orderId}"] .order-head`).click();
  await wait(300);
}
(async () => {
  const b = await launch();
  let ctx = await phone(b, {}); let p = await ctx.newPage(); watch(p);

  // --- Entrar con nombre + 4 digitos ---
  await p.goto(BASE + 'index.html', { waitUntil: 'networkidle' }); await wait(500);
  await p.screenshot({ path: 'shots/a01-login.png' });
  await p.fill('#si-first', 'Carlos'); await p.fill('#si-last', 'Ramirez'); await p.fill('#si-temp', '4021');
  await p.click('#si-btn'); await wait(500);
  await p.screenshot({ path: 'shots/a02-login-error.png' });
  await p.click('text=Create an account'); await wait(200);
  await p.fill('#rg-first', 'Carlos'); await p.fill('#rg-last', 'Ramírez'); await p.fill('#rg-phone', '(515) 555-4021'); await p.fill('#rg-email', 'carlos@example.com');
  await p.screenshot({ path: 'shots/a03-register.png' });
  await p.click('#rg-btn'); await wait(500);
  await p.screenshot({ path: 'shots/a04-register-pending.png' });

  // --- Configurar el telefono con el QR (Android) ---
  await p.goto(BASE + 'device-setup.html?setup=demo', { waitUntil: 'networkidle' }); await wait(500);
  await p.screenshot({ path: 'shots/a05-setup-confirm.png' });
  await p.evaluate(() => { GS.pushState = () => 'on'; GS.subscribePush = async () => true; });
  await p.click('#confirm-btn'); await wait(400);
  await p.screenshot({ path: 'shots/a07-setup-done.png' });
  await ctx.close();

  // --- iPhone: primero el icono ---
  ctx = await phone(b, { ua: IPHONE }); p = await ctx.newPage(); watch(p);
  await p.goto(BASE + 'device-setup.html?setup=demo', { waitUntil: 'networkidle' }); await wait(500);
  await p.screenshot({ path: 'shots/a06-setup-ios.png' });
  await ctx.close();

  // --- Empleado: Active Orders ---
  ctx = await phone(b, { who: 'emp' }); p = await ctx.newPage(); watch(p);
  await p.goto(BASE + 'employee.html', { waitUntil: 'networkidle' }); await wait(800);
  await p.screenshot({ path: 'shots/b01-active.png' });
  await p.locator('nav').screenshot({ path: 'shots/a08-nav.png' });
  await openCard(p, 'GS-10482'); await shotCard(p, '.order-card[data-order="GS-10482"]', 'b02-order-open');
  await openCard(p, 'GS-10482');
  await openCard(p, 'GS-10477'); await shotCard(p, '.order-card[data-order="GS-10477"]', 'b03-order-package');
  await openCard(p, 'GS-10477');
  await openCard(p, 'GS-10490'); await shotCard(p, '.order-card[data-order="GS-10490"]', 'b05-by-service');
  await openCard(p, 'GS-10490');
  await openCard(p, 'GS-10495'); await shotCard(p, '.order-card[data-order="GS-10495"]', 'b06-by-place');
  await p.locator('.order-card[data-order="GS-10495"] >> text=The client asked for something not on my list').click();
  await p.fill('#extra-note-GS_10495', 'Clean the 2nd floor conference room — they have a meeting Monday.');
  await shotCard(p, '#extra-form-GS_10495', 'b07-extra-form');
  await p.click('#extra-form-GS_10495 >> text=Send to office'); await wait(300);
  await p.screenshot({ path: 'shots/b08-extra-sent.png' });
  await openCard(p, 'GS-10495');
  await openCard(p, 'GS-10470'); await shotCard(p, '.order-card[data-order="GS-10470"]', 'b09-marked-done');
  await openCard(p, 'GS-10470');
  await p.goto(BASE + 'employee.html', { waitUntil: 'networkidle' }); await wait(800);
  await p.fill('#active-search', 'river'); await wait(200);
  await p.screenshot({ path: 'shots/b04-search.png' });

  // Regreso de la camara con la foto obligatoria -> se marca solo
  await p.goto(BASE + 'employee.html?completeOrder=GS-10482', { waitUntil: 'networkidle' }); await wait(700);
  await p.screenshot({ path: 'shots/b10-done-toast.png' });

  // --- Camara ---
  await p.goto(BASE + 'camera-capture.html?context=order-photo&orderId=GS-10482&return=employee.html', { waitUntil: 'networkidle' }); await wait(1500);
  await p.screenshot({ path: 'shots/c01-camera.png' });
  for (let i = 0; i < 3; i++) { await p.click('#shutter-btn'); await wait(500); }
  await wait(1500);
  await p.screenshot({ path: 'shots/c02-camera-photos.png' });
  await p.goto(BASE + 'camera-capture.html?context=service-photo&orderId=GS-10482&serviceName=Paint%20walls&label=Paint%20walls&return=employee.html', { waitUntil: 'networkidle' }); await wait(1200);
  await p.click('#shutter-btn'); await wait(1200);
  await p.screenshot({ path: 'shots/c03-camera-service.png' });
  await p.goto(BASE + 'camera-capture.html?context=order-photo&orderId=GS-10482&return=employee.html&requireAtLeastOne=1&completeAfter=1', { waitUntil: 'networkidle' }); await wait(1200);
  await p.click('#done-btn'); await wait(300);
  await p.screenshot({ path: 'shots/c04-camera-required.png' });
  // Sin senal
  await p.evaluate(() => fetch('/__fail-uploads?on=1'));
  await p.goto(BASE + 'camera-capture.html?context=order-photo&orderId=GS-10477&return=employee.html', { waitUntil: 'networkidle' }); await wait(1200);
  await p.click('#shutter-btn'); await wait(400); await p.click('#shutter-btn'); await wait(2500);
  await p.screenshot({ path: 'shots/c05-camera-nosignal.png' });
  await p.goto(BASE + 'employee.html', { waitUntil: 'networkidle' }); await wait(1500);
  await p.screenshot({ path: 'shots/c06-banner-waiting.png', clip: { x: 0, y: 0, width: 390, height: 420 } });
  await p.evaluate(() => fetch('/__fail-uploads?on=0'));
  await ctx.close();
  await b.close();
  console.log('done');
})();
