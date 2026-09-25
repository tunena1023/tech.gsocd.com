/* ============================================================
   setup-manifest.js -- manifest de la pantalla de "Set Up Phone"
   (25/09/2026). En iPhone los avisos push solo funcionan desde el
   icono en la pantalla de inicio, y ese icono se agrega ANTES de
   confirmar el telefono. Este manifest hace que el icono abra
   device-setup.html con el MISMO link del QR, para terminar ahi la
   configuracion (confirmar + permitir avisos). El link se usa una sola
   vez; despues el icono cae en index.html (ver device-setup.html).
   Publico: no trae nada secreto, solo repite el link del QR.
============================================================ */
exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  const setup = /^[a-f0-9]{16,64}$/i.test(String(q.setup || '')) ? String(q.setup) : '';
  const manifest = {
    name: 'GS Solutions Tech',
    short_name: 'GS Tech',
    start_url: setup ? '/device-setup.html?setup=' + setup : '/',
    scope: '/',
    display: 'standalone',
    background_color: '#111111',
    theme_color: '#111111',
    icons: [{ src: '/api/site-image?name=Logo.jpg', sizes: 'any', type: 'image/jpeg', purpose: 'any' }]
  };
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(manifest)
  };
};
