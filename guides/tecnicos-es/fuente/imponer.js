/* Librito (saddle stitch): 2 paginas de media carta por cara de una hoja carta
   horizontal. Imprimir a doble cara volteando por el lado corto, doblar y engrapar. */
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
(async () => {
  const src = await PDFDocument.load(fs.readFileSync(process.argv[2]));
  let n = src.getPageCount();
  const total = Math.ceil(n / 4) * 4;
  const out = await PDFDocument.create();
  const embedded = await out.embedPages(src.getPages());
  const W = 792, H = 612, HW = 396;
  const put = (page, idx, x) => { if (idx < n) page.drawPage(embedded[idx], { x, y: 0, width: HW, height: H }); };
  for (let i = 0; i < total / 4; i++) {
    const front = out.addPage([W, H]);
    put(front, total - 1 - 2 * i, 0); put(front, 2 * i, HW);
    const back = out.addPage([W, H]);
    put(back, 2 * i + 1, 0); put(back, total - 2 - 2 * i, HW);
  }
  fs.writeFileSync(process.argv[3], await out.save());
  console.log('paginas', n, '-> hojas', total / 4, '(caras', total / 2 + ')');
})();
