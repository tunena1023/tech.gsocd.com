/* ============================================================
   upload-photo.js — sube una foto O VIDEO tomado en sitio a
   SharePoint, y deja un registro aparte (TechPhotoLog) con quien lo
   subio, cuando, y donde -- confirmado con el usuario: la foto/video
   sigue siendo obligatoria como siempre, pero ahora ademas guarda su
   ubicacion real (con permiso del navegador, pedido una sola vez)
   para el reporte de Times and Routes (pendiente).

   Estructura (raiz del drive):
     TechPhotos / <ClientID> - <BusinessName> / <OrderID> / Photos / <fecha-hora>.jpg|mp4

   El nombre del archivo sigue siendo solo fecha-hora, sin nombre de
   empleado -- quien lo subio vive en TechPhotoLog, no en el nombre
   del archivo (mismo criterio de siempre, solo que ahora si queda
   registrado en algun lado).
============================================================ */

const {
  ORDERS_LIST, TECH_PHOTO_LOG_LIST, ensureFolder, uploadFile, createListItem, graphFetch, siteListPath, jsonResponse
} = require('./lib/graph');

const PHOTOS_FOLDER = process.env.GRAPH_PHOTOS_FOLDER || 'TechPhotos';
const MAX_VIDEO_BYTES = 60 * 1024 * 1024; /* ~60MB, respaldo de servidor -- el limite real
   de 5 minutos se revisa del lado del navegador (ve la duracion real
   del video); esto es solo para no aceptar algo absurdamente grande
   si por lo que sea ese chequeo no corrio. */

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

/* randomSuffix(): fileTimestamp() solo tiene precision de segundos --
   sin esto, 2 fotos en el mismo segundo se pisarian entre si en
   SharePoint (el PUT reemplaza silenciosamente, no avisa). */
function randomSuffix() {
  return Math.random().toString(36).slice(2, 6);
}

/* photoKey (gsocd-shared camera-queue v1.70.0, 25/09/2026): nombre fijo
   que la foto trae desde que se tomo ("AAAA-MM-DD_HHMMSS-xxxxxx", UTC).
   Si la misma foto llega 2 veces (Done antes de que terminara de subir y
   la otra pagina la reenvia), se escribe en el MISMO archivo en vez de
   crear una copia. Sin photoKey (fotos viejas en la cola), como antes. */
function photoStamp(b, now) {
  const k = String((b && b.photoKey) || '');
  return /^\d{4}-\d{2}-\d{2}_\d{6}-[a-z0-9]{4,12}$/.test(k) ? k : fileTimestamp(now || new Date()) + '-' + randomSuffix();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  try {
    const b = JSON.parse(event.body || '{}');
    const orderId = String(b.orderId || '').trim();
    const fileBase64 = b.imageBase64 || b.fileBase64;
    const isVideo = !!b.isVideo;
    const techId = String(b.techId || '').trim();
    const latitude = (b.latitude !== undefined && b.latitude !== null) ? Number(b.latitude) : null;
    const longitude = (b.longitude !== undefined && b.longitude !== null) ? Number(b.longitude) : null;

    if (!orderId) return jsonResponse(400, { error: 'orderId is required' });
    if (!fileBase64) return jsonResponse(400, { error: 'No file data received' });

    const rows = await fetchByField(ORDERS_LIST, 'OrderID', orderId);
    const orderItem = rows.find(it => it.fields);
    if (!orderItem) return jsonResponse(404, { error: 'Order not found.' });
    const f = orderItem.fields;

    const clientLabel = (String(f.ClientID || '').trim() + ' - ' + String(f.BusinessName || '').trim())
      .replace(/[\\/:*?"<>|]/g, '').trim() || orderId;
    const folderPath = PHOTOS_FOLDER + '/' + clientLabel + '/' + orderId + '/Photos';

    const buffer = Buffer.from(fileBase64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (isVideo && buffer.length > MAX_VIDEO_BYTES) {
      return jsonResponse(400, { error: 'That video is too large. Please keep videos under 5 minutes.' });
    }

    const now = new Date();
    const ext = isVideo ? 'mp4' : 'jpg';
    const contentType = isVideo ? 'video/mp4' : 'image/jpeg';
    /* Foto de inspeccion (25/09/2026): mientras la orden esta en
       'Inspection', el archivo lleva el prefijo insp- -- las galerias
       lo usan para separar "Inspection (antes)" de "Work (despues)".
       Las fotos son publicas: el cliente las ve igual que las demas. */
    const stagePrefix = f.Status === 'Inspection' ? 'insp-' : '';
    const fileName = stagePrefix + photoStamp(b, now) + '.' + ext;

    await ensureFolder(folderPath);
    const result = await uploadFile(folderPath, fileName, buffer, contentType);

    /* Registro aparte con quien/cuando/donde -- si esto falla, no
       tumba la subida (el archivo ya se guardo bien, que es lo que
       de verdad importa para el trabajo del dia a dia). */
    try {
      /* Reenvio de la misma foto (photoKey): el archivo se reemplazo, el
         registro ya existe -- no se duplica. */
      let alreadyLogged = false;
      if (b.photoKey) {
        const q = siteListPath(TECH_PHOTO_LOG_LIST) + '?$expand=fields&$top=1&$filter=' + encodeURIComponent(`fields/FileName eq '${fileName.replace(/'/g, "''")}'`);
        const found = await graphFetch(q, { headers: { Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly' } }).catch(() => null);
        alreadyLogged = !!(found && found.value && found.value.length);
      }
      if (!alreadyLogged) await createListItem(TECH_PHOTO_LOG_LIST, {
        Title: orderId,
        TechId: techId,
        FileName: fileName,
        IsVideo: isVideo,
        Latitude: latitude,
        Longitude: longitude,
        CapturedDate: now.toISOString()
      });
    } catch (logErr) {
      console.error('TechPhotoLog write failed:', logErr.message);
    }

    return jsonResponse(200, { success: true, fileName, webUrl: result.webUrl });
  } catch (e) {
    return jsonResponse(500, { error: e.message });
  }
};

