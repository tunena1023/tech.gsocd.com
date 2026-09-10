/* ============================================================
   upload-recurring-photo.js — sube una foto (opcional, a diferencia
   de una orden normal donde es obligatoria) tomada en una visita de
   un contrato recurrente. Mismo patron exacto que upload-photo.js:
   camara nativa del telefono, ubicacion + hora en TechPhotoLog.

   Estructura (raiz del drive):
     TechPhotos / <ClientID> - <BusinessName> / Recurring /
       <RecurringServiceID> / <VisitDate> / Photos / <fecha-hora>.jpg
============================================================ */

const {
  RECURRING_SERVICES_LIST, CLIENTS_LIST, TECH_PHOTO_LOG_LIST,
  ensureFolder, uploadFile, createListItem, graphFetch, siteListPath, jsonResponse
} = require('./lib/graph');

const PHOTOS_FOLDER = process.env.GRAPH_PHOTOS_FOLDER || 'TechPhotos';
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;

async function fetchAll(listName) {
  let url = siteListPath(listName) + '?$expand=fields&$top=500';
  const out = [];
  while (url) {
    const data = await graphFetch(url);
    out.push(...(data.value || []));
    url = data['@odata.nextLink'] || null;
  }
  return out;
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
    const recurringServiceId = String(b.recurringServiceId || '').trim();
    const visitDate = String(b.visitDate || '').trim();
    const fileBase64 = b.imageBase64 || b.fileBase64;
    const isVideo = !!b.isVideo;
    const techId = String(b.techId || '').trim();
    const latitude = (b.latitude !== undefined && b.latitude !== null) ? Number(b.latitude) : null;
    const longitude = (b.longitude !== undefined && b.longitude !== null) ? Number(b.longitude) : null;

    if (!recurringServiceId) return jsonResponse(400, { error: 'recurringServiceId is required' });
    if (!visitDate) return jsonResponse(400, { error: 'visitDate is required' });
    if (!fileBase64) return jsonResponse(400, { error: 'No file data received' });

    const [svcRows, clientRows] = await Promise.all([fetchAll(RECURRING_SERVICES_LIST), fetchAll(CLIENTS_LIST)]);
    const svc = svcRows.find(it => it.id === recurringServiceId);
    if (!svc || !svc.fields) return jsonResponse(404, { error: 'Recurring contract not found.' });
    const clientRow = clientRows.find(it => it.fields && it.fields.ClientID === svc.fields.ClientID);
    const businessName = clientRow && clientRow.fields ? (clientRow.fields.Title || clientRow.fields.BusinessName || '') : '';

    const clientLabel = (String(svc.fields.ClientID || '').trim() + ' - ' + String(businessName).trim())
      .replace(/[\\/:*?"<>|]/g, '').trim() || recurringServiceId;
    const folderPath = PHOTOS_FOLDER + '/' + clientLabel + '/Recurring/' + recurringServiceId + '/' + visitDate + '/Photos';

    const buffer = Buffer.from(fileBase64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (isVideo && buffer.length > MAX_VIDEO_BYTES) {
      return jsonResponse(400, { error: 'That video is too large. Please keep videos under 5 minutes.' });
    }

    const now = new Date();
    const ext = isVideo ? 'mp4' : 'jpg';
    const contentType = isVideo ? 'video/mp4' : 'image/jpeg';
    const fileName = fileTimestamp(now) + '.' + ext;

    await ensureFolder(folderPath);
    const result = await uploadFile(folderPath, fileName, buffer, contentType);

    try {
      await createListItem(TECH_PHOTO_LOG_LIST, {
        Title: recurringServiceId + '-' + visitDate,
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
