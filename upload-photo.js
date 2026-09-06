/* ============================================================
   upload-photo.js — sube una foto tomada en sitio a SharePoint.

   Estructura (raiz del drive):
     <ClientID> - <BusinessName> / <OrderID> / Fotos / <fecha-hora>.jpg

   Mismo patron que ya usa la carpeta de PDFs de ordenes (ORDERS_FOLDER)
   en los otros 2 repos, pero como carpeta aparte en la raiz (no dentro
   de esa misma) para no mezclar PDFs con fotos.

   No importa quien tomo la foto -- el nombre del archivo es solo la
   fecha y hora en que se tomo, sin nombre de empleado.
============================================================ */

const {
  ORDERS_LIST, ensureFolder, uploadFile, graphFetch, siteListPath, jsonResponse
} = require('./lib/graph');

const PHOTOS_FOLDER = process.env.GRAPH_PHOTOS_FOLDER || 'TechPhotos';

async function fetchByField(listName, fieldName, value) {
  const filter = encodeURIComponent(`fields/${fieldName} eq '${value}'`);
  const url = siteListPath(listName) + `?$expand=fields&$top=50&$filter=${filter}`;
  const data = await graphFetch(url);
  return data.value || [];
}

function fileTimestamp(d) {
  const pad = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
    + '_' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  try {
    const b = JSON.parse(event.body || '{}');
    const orderId = String(b.orderId || '').trim();
    const imageBase64 = b.imageBase64;
    if (!orderId) return jsonResponse(400, { error: 'orderId is required' });
    if (!imageBase64) return jsonResponse(400, { error: 'No image data received' });

    const rows = await fetchByField(ORDERS_LIST, 'OrderID', orderId);
    const orderItem = rows.find(it => it.fields);
    if (!orderItem) return jsonResponse(404, { error: 'Order not found.' });
    const f = orderItem.fields;

    const clientLabel = (String(f.ClientID || '').trim() + ' - ' + String(f.BusinessName || '').trim())
      .replace(/[\\/:*?"<>|]/g, '').trim() || orderId;
    const folderPath = PHOTOS_FOLDER + '/' + clientLabel + '/' + orderId + '/Fotos';

    const fileName = fileTimestamp(new Date()) + '.jpg';
    const buffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');

    await ensureFolder(folderPath);
    const result = await uploadFile(folderPath, fileName, buffer, 'image/jpeg');

    return jsonResponse(200, { success: true, fileName, webUrl: result.webUrl });
  } catch (e) {
    return jsonResponse(500, { error: e.message });
  }
};
