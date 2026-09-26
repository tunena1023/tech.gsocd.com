/* Helpers compartidos: contexto de telefono + CDN via Node (confia en el CA del proxy). */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const CACHE = path.join(__dirname, 'cdn-cache'); fs.mkdirSync(CACHE, { recursive: true });
async function cdn(route) {
  const url = route.request().url();
  const key = path.join(CACHE, crypto.createHash('md5').update(url).digest('hex'));
  try {
    if (!fs.existsSync(key)) {
      const r = await fetch(url);
      const buf = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(key, buf); fs.writeFileSync(key + '.meta', JSON.stringify({ status: r.status, type: r.headers.get('content-type') || '' }));
    }
    const meta = JSON.parse(fs.readFileSync(key + '.meta', 'utf8'));
    await route.fulfill({ status: meta.status, contentType: meta.type, body: fs.readFileSync(key), headers: { 'access-control-allow-origin': '*' } });
  } catch (e) { await route.abort(); }
}
const TECH = {
  emp: { id: 'T-1042', firstName: 'Carlos', lastName: 'Ramírez', role: 'Employee', division: 'Renovations' },
  sup: { id: 'T-2001', firstName: 'Laura', lastName: 'Méndez', role: 'Supervisor', division: 'Mixed' }
};
async function launch(opts = {}) {
  return chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + path.join(__dirname, 'photos/cam.mjpeg')], ...opts });
}
async function phone(browser, { who, lang = 'en', ua, geo = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: 'America/Chicago', locale: 'en-US', isMobile: true, hasTouch: true,
    userAgent: ua || 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
    permissions: ['camera', 'geolocation'], geolocation: { latitude: 41.5868, longitude: -93.625 } });
  await ctx.route(/^https:\/\//, cdn);
  await ctx.addInitScript(([t, l]) => {
    if (t) sessionStorage.setItem('gs_tech', JSON.stringify(t));
    localStorage.setItem('gs_tech_lang', l);
  }, [who ? TECH[who] : null, lang]);
  return ctx;
}
module.exports = { launch, phone, TECH, BASE: 'http://localhost:8787/' };
