/* ============================================================
   get-my-gallery.js — fotos agrupadas por orden.

   No hay ninguna lista de SharePoint que registre las fotos por
   separado -- todo se deduce leyendo la carpeta directo:
   TechPhotos/<ClientID> - <BusinessName>/<OrderID>/Photos/*.jpg
   (mismo criterio ya confirmado: no importa quien tomo cada foto).

   Employee: solo las ordenes que tiene/tuvo asignadas (OrderAssignments).
   Supervisor: todas las de su departamento (Division), sin importar
   si siguen activas o ya se cerraron -- la galeria no es solo de lo
   activo, es historico.
============================================================ */

const {
  ORDERS_LIST, ORDER_SERVICES_LIST, SCHEDULING_LIST, TECHS_LIST,
  listChildren, graphFetch, siteListPath, jsonResponse
} = require('./lib/graph');
const graph = require('./lib/graph');
const orderDocs = require('./lib/order-docs');

const PHOTOS_FOLDER = process.env.GRAPH_PHOTOS_FOLDER || 'TechPhotos';

/* Fotos de un servicio especifico (camara junto a cada servicio en
   Active Orders) traen el nombre del servicio y el momento en que se
   tomaron codificados en el archivo mismo --
   "svc-<ServiceNameSafe>-<timestamp>.jpg" (mismo formato exacto que
   ya usa Admin, mismo endpoint de subida: upload-service-photo.js).
   Sin ninguna columna nueva en SharePoint. La nota (si hay) siempre
   se lee de NotCompletedReason en OrderServices en ese momento, nunca
   se duplica aqui. Calcado de Admingsocd.com/get-admin-gallery.js
   para que se vea IGUAL en los 2 lados. */
const SVC_PHOTO_PREFIX = /^svc-(.+?)-(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})(\d{2})(?:-[a-z0-9]+)?\.[a-z0-9]+$/i;
function safeName(s) { return String(s || '').replace(/[^a-z0-9]/gi, '_'); }

/* El nombre del archivo guarda la hora del SERVIDOR (Vercel corre en
   UTC), no la hora de Iowa -- hay que convertir a America/Chicago
   antes de mostrarla. Intl.DateTimeFormat calcula solo el ajuste de
   CDT/CST segun la fecha. */
function formatSvcPhotoDate(y, mo, d, h, mi) {
  const utcDate = new Date(Date.UTC(parseInt(y, 10), parseInt(mo, 10) - 1, parseInt(d, 10), parseInt(h, 10), parseInt(mi, 10)));
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  }).formatToParts(utcDate);
  const get = type => (parts.find(p => p.type === type) || {}).value || '';
  return get('month') + ' ' + get('day') + ', ' + get('year') + ' · ' + get('hour') + ':' + get('minute') + ' ' + get('dayPeriod');
}

/* Fallback para fotos que no matchean el prefijo svc- (sin caption
   propio): listChildren() ya trae createdDateTime (Graph lo da
   gratis), se usa aqui con el mismo criterio de zona horaria que
   formatSvcPhotoDate (America/Chicago). */
function formatIsoDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  }).formatToParts(d);
  const get = type => (parts.find(p => p.type === type) || {}).value || '';
  return get('month') + ' ' + get('day') + ', ' + get('year') + ' · ' + get('hour') + ':' + get('minute') + ' ' + get('dayPeriod');
}

async function fetchByOrderId(listName, orderId) {
  const filter = encodeURIComponent(`fields/OrderID eq '${orderId}'`);
  let url = siteListPath(listName) + `?$expand=fields&$top=200&$filter=${filter}`;
  const out = [];
  while (url) {
    const data = await graphFetch(url);
    out.push(...(data.value || []));
    url = data['@odata.nextLink'] || null;
  }
  return out;
}

/* Ahora tambien regresa la lista completa de servicios programados
   (columna "Scheduled Services" de Gallery, rediseño 19/09/2026) --
   ya no se puede saltar el query aunque ninguna foto traiga el
   prefijo svc-, la lista se necesita independiente de las fotos. */
async function buildServiceCaptionsAndList(orderId, photoNames) {
  const svcNamesInPhotos = photoNames
    .map(n => (n.match(SVC_PHOTO_PREFIX) || [])[1])
    .filter(Boolean);

  const rows = await fetchByOrderId(ORDER_SERVICES_LIST, orderId);
  const bySafeName = {};
  const services = [];
  rows.forEach(it => {
    const f = it.fields || {};
    const name = f.ServiceName || '';
    if (!name) return;
    const level = f.Level || '';
    bySafeName[safeName(name)] = { name, level, reason: f.NotCompletedReason || '' };
    services.push({ name, level });
  });

  const captions = {};
  if (svcNamesInPhotos.length) {
    photoNames.forEach(fileName => {
      const m = fileName.match(SVC_PHOTO_PREFIX);
      if (!m) return;
      const svc = bySafeName[m[1]];
      if (!svc) return;
      const dateStr = formatSvcPhotoDate(m[2], m[3], m[4], m[5], m[6]);
      const sortKey = new Date(Date.UTC(
        parseInt(m[2], 10), parseInt(m[3], 10) - 1, parseInt(m[4], 10),
        parseInt(m[5], 10), parseInt(m[6], 10), parseInt(m[7] || '0', 10)
      )).toISOString();
      captions[fileName] = {
        serviceName: svc.name,
        level: svc.level || '',
        reason: svc.reason || '',
        caption: dateStr,
        sortKey
      };
    });
  }
  return { captions, services };
}

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

function clientFolderName(f) {
  return (String(f.ClientID || '').trim() + ' - ' + String(f.BusinessName || '').trim())
    .replace(/[\\/:*?"<>|]/g, '').trim();
}

/* Ordenes que este tecnico puede ver (mismo criterio que get-my-orders).
   Tambien lo usa order-docs.js para dejar ver un documento. */
async function scopedOrders(techId, role, division) {
  const [orderRows, schedulingRows, techRows] = await Promise.all([
    fetchAll(ORDERS_LIST),
    role === 'Employee' ? fetchAll(SCHEDULING_LIST) : Promise.resolve([]),
    role === 'Employee' ? fetchAll(TECHS_LIST) : Promise.resolve([])
  ]);

  let myOrders = orderRows.filter(it => it.fields);
  if (role === 'Developer') {
    /* Ve todo -- mismo criterio que get-my-orders.js/get-my-history.js. */
  } else if (role === 'Supervisor') {
    /* Mismo fix que get-my-orders.js: Mixed = las 3 divisiones. */
    if (division.toLowerCase() !== 'mixed') {
      myOrders = myOrders.filter(it => String(it.fields.Division || '').toLowerCase() === division.toLowerCase());
    }
  } else {
    /* Mismo arreglo que get-my-orders.js/get-my-history.js: Admin
       guarda la asignacion real en Scheduling con el PayrollNumber
       del tecnico, nunca en OrderAssignments/TechID. */
    const myTechRow = techRows.find(it => it.id === techId);
    const myPayrollId = myTechRow && myTechRow.fields ? String(myTechRow.fields.PayrollID || '').trim() : '';
    const myOrderIds = new Set(
      schedulingRows.filter(it => it.fields && String(it.fields.PayrollNumber || '').trim() === myPayrollId)
        .map(it => it.fields.OrderID)
    );
    myOrders = myOrders.filter(it => myOrderIds.has(it.fields.OrderID || it.fields.Title));
  }

  return myOrders;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  try {
    const b = JSON.parse(event.body || '{}');
    const techId = String(b.techId || '').trim();
    const role = String(b.role || '').trim();
    const division = String(b.division || '').trim();
    if (!techId || !role) return jsonResponse(400, { error: 'techId and role are required' });

    const myOrders = await scopedOrders(techId, role, division);

    const groups = await Promise.all(myOrders.map(async (it) => {
      const f = it.fields;
      const orderId = f.OrderID || f.Title || '';
      const folderPath = PHOTOS_FOLDER + '/' + clientFolderName(f) + '/' + orderId + '/Photos';
      const kids = await listChildren(folderPath);
      const photos = kids.filter(k => k.isFile).sort((a, b) => a.name.localeCompare(b.name));
      if (!photos.length) return null;
      const { captions, services } = await buildServiceCaptionsAndList(orderId, photos.map(p => p.name));
      return {
        orderId,
        clientLabel: f.BusinessName || f.ClientID || '',
        division: f.Division || '',
        date: f.EntryDate || f.DispatchDate || '',
        bedrooms: f.Bedrooms || '',
        bathrooms: f.Bathrooms || '',
        supervisor: f.Supervisor || '',
        unitNumber: f.UnitNumber || '',
        completedDate: f.CompletedDate || '',
        services,
        photos: photos.map(p => {
          const info = captions[p.name];
          return {
            name: p.name,
            downloadUrl: p.downloadUrl,
            serviceName: info ? info.serviceName : null,
            level: (info && info.level) || '',
            reason: (info && info.reason) || '',
            caption: (info && info.caption) || formatIsoDate(p.createdDateTime) || undefined,
            sortKey: (info && info.sortKey) || p.createdDateTime || '',
            /* Foto de inspeccion (antes) vs de trabajo (despues), 25/09/2026:
               upload-photo (Tech) le pone insp- mientras la orden esta en
               'Inspection'. gallery-groups v1.69.0 las separa en 2 pestañas. */
            stage: /^insp-/i.test(p.name) ? 'inspection' : 'work'
          };
        })
      };
    }));

    const nonEmpty = groups.filter(Boolean).sort((a, b) => String(b.date).localeCompare(String(a.date)));

    /* Documentos (Gallery > Docs, 25/09/2026): solo ver, de las mismas
       ordenes que puede ver en su portal. */
    const byId = {};
    myOrders.forEach(it => { byId[it.fields.OrderID || it.fields.Title || ''] = it.fields; });
    const docs = await orderDocs.listDocs(graph, { orderIds: Object.keys(byId) });
    const docGroups = orderDocs.groupDocs(docs, id => {
      const f = byId[id] || {};
      return [f.BusinessName || f.ClientID || '', f.UnitNumber ? 'Unit ' + f.UnitNumber : ''].filter(Boolean).join(' · ') || id;
    });

    return jsonResponse(200, { groups: nonEmpty, docGroups });
  } catch (e) {
    return jsonResponse(500, { error: e.message });
  }
};

exports.scopedOrders = scopedOrders;
