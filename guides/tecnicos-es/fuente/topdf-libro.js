const { chromium } = require('playwright');
const path = require("path");
const { phone } = require('./lib');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext();
  await ctx.route(/^https:\/\//, async route => {
    try { const r = await fetch(route.request().url()); await route.fulfill({ status: r.status, contentType: r.headers.get('content-type') || '', body: Buffer.from(await r.arrayBuffer()) }); } catch (e) { await route.abort(); }
  });
  const p = await ctx.newPage();
  await p.goto('file://' + path.join(__dirname, process.argv[2]), { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: process.argv[3], width: '5.5in', height: '8.5in', printBackground: true, displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: '<div style="font-size:6.5px;color:#888;width:100%;padding:0 0.42in;display:flex;justify-content:space-between;font-family:Arial"><span>GS Solutions · Guía del Portal de Técnicos</span><span class="pageNumber"></span></div>',
    margin: { top: '0.42in', bottom: '0.5in', left: '0.42in', right: '0.42in' } });
  await b.close();
})();
