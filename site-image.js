/* ============================================================
   site-image.js — version minima para este portal: solo sirve
   archivos de la RAIZ del drive de SharePoint (?name=X), que es
   todo lo que tech.gsocd.com necesita (Logo.jpg, NavBackground.jpg).
   Mismo patron que la version completa de ordersgsocd.com/admin.
============================================================ */

const { driveItemByPath, downloadById, jsonResponse } = require('./lib/graph');

const MAX_BYTES = 4.5 * 1024 * 1024;

function typeOf(name) {
  const ext = String(name || '').toLowerCase().split('.').pop();
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

exports.handler = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const name = params.name;
    if (!name) return jsonResponse(400, { error: 'name is required' });

    const item = await driveItemByPath(String(name));
    if (!item || (item.size || 0) > MAX_BYTES) {
      return jsonResponse(404, { error: 'not found' });
    }
    const buffer = await downloadById(item.id);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': typeOf(item.name),
        'Cache-Control': 'public, max-age=600'
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true
    };
  } catch (e) {
    return jsonResponse(500, { error: e.message });
  }
};
