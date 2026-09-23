/* ============================================================
   submit-service-complete.js — el empleado marca UN SERVICIO
   especifico como terminado, en una orden con "Assign by service"
   (21/09/2026). Version por-servicio de submit-employee-complete.js
   -- mismo requisito real: no se puede sin al menos 1 foto de ESE
   servicio en particular (mismo prefijo real que ya usa la camarita
   por servicio, upload-service-photo.js: "svc-<ServiceNameSafe>-").

   NO completa el servicio de verdad -- deja WorkStatus:
   'Pending Review' (mismo estatus que ya usa el modelo por servicio)
   y su propio evento 'Service Marked Done By Tech' en el historial
   real (mismo ChangeType que ya sabe leer order-history.js v1.44.0,
   oculto del cliente). Oficina confirma de verdad desde Active, con
   su propio boton (complete-service-assignment.js en Admingsocd.com)
   -- eso no cambia aqui.
============================================================ */
const {
  ORDERS_LIST, SERVICE_ASSIGNMENTS_LIST, ORDER_HISTORY_LIST, TECHS_LIST,
  updateListItemByItemId, createListItem,
  graphFetch, siteListPath, listChildren, jsonResponse
} = require('./lib/graph');

const PHOTOS_FOLDER = process.env.GRAPH_PHOTOS_FOLDER || 'TechPhotos';

async function fetchByField(listName, fieldName, value) {
  const filter = encodeURIComponent(`fields/${fieldName} eq '${value}'`);
  const url = siteListPath(listName) + `?$expand=fields&$top=200&$filter=${filter}`;
  const data = await graphFetch(url);
  return data.value || [];
}

async function fetchByOrderId(listName, orderId, honorNonIndexed) {
  const filter = encodeURIComponent(`fields/OrderID eq '${orderId}'`);
  let url = siteListPath(listName) + `?$expand=fields&$top=200&$filter=${filter}`;
  const out = [];
  const opts = honorNonIndexed ? { headers: { Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly' } } : {};
  while (url) {
    const data = await graphFetch(url, opts);
    out.push(...(data.value || []));
    url = data['@odata.nextLink'] || null;
  }
  return out;
}

function safeName(s) { return String(s || '').trim().replace(/[^a-z0-9]/gi, '_'); }

/* Misma carpeta/prefijo real que ya usa upload-service-photo.js --
   sin columna nueva, el nombre del archivo mismo dice a que servicio
   pertenece. */
async function hasServicePhoto(clientId, businessName, orderId, serviceName) {
  const clientLabel = (String(clientId || '').trim() + ' - ' + String(businessName || '').trim())
    .replace(/[\\/:*?"<>|]/g, '').trim() || orderId;
  const folderPath = PHOTOS_FOLDER + '/' + clientLabel + '/' + orderId + '/Photos';
  const prefix = 'svc-' + safeName(serviceName) + '-';
  try {
    const children = await listChildren(folderPath);
    return (children || []).some(c => String(c.name || '').indexOf(prefix) === 0);
  } catch (e) {
    return false;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  try {
    const b = JSON.parse(event.body || '{}');
    const required = ['orderId', 'category', 'serviceName', 'techId'];
    for (const k of required) if (!b[k]) return jsonResponse(400, { error: k + ' is required' });

    const orderRows = await fetchByField(ORDERS_LIST, 'OrderID', b.orderId);
    const orderItem = orderRows.find(it => it.fields);
    if (!orderItem) return jsonResponse(404, { error: 'Order not found.' });
    const f = orderItem.fields;

    /* Se trae la lista completa y se busca por it.id (mismo patron
       real que ya usa get-my-orders.js) -- Techs no tiene un campo
       util para filtrar por id via OData. */
    const allTechRows = await (async () => {
      let url = siteListPath(TECHS_LIST) + '?$expand=fields&$top=500';
      const out = [];
      while (url) { const data = await graphFetch(url); out.push(...(data.value || [])); url = data['@odata.nextLink'] || null; }
      return out;
    })();
    const myTechRow = allTechRows.find(it => it.id === b.techId);
    const myName = myTechRow && myTechRow.fields ? (String(myTechRow.fields.FirstName || '') + ' ' + String(myTechRow.fields.LastName || '')).trim() : '';
    if (!myName) return jsonResponse(404, { error: 'Technician not found.' });

    /* Recurrentes "Who does what" por lugar (23/09/2026): placeMode
       marca de un jalon TODOS los servicios de este tecnico en ese
       LUGAR (misma Category, ej. "Floor 1 / Hallway"). La foto
       obligatoria es la del lugar: employee.html la sube con el lugar
       como nombre (mismo prefijo svc-<nombre>- de siempre). Sin
       placeMode, todo exactamente igual que antes. */
    const placeMode = b.placeMode === true;
    const photoKey = placeMode ? b.category : b.serviceName;
    const hasPhoto = await hasServicePhoto(f.ClientID, f.BusinessName, b.orderId, photoKey);
    if (!hasPhoto) return jsonResponse(400, { error: placeMode ? 'Take at least 1 photo of this place before marking it done.' : 'Take at least 1 photo of this service before marking it done.' });

    const assignmentRows = await fetchByOrderId(SERVICE_ASSIGNMENTS_LIST, b.orderId, true);
    const mine = it => String(it.fields.AssignedTo || '').split(',').map(n => n.trim()).includes(myName);
    let targets;
    if (placeMode) {
      const inPlace = assignmentRows.filter(it => it.fields && (it.fields.Category || '') === b.category);
      if (!inPlace.length) return jsonResponse(404, { error: 'This place is not scheduled yet.' });
      targets = inPlace.filter(mine);
      if (!targets.length) return jsonResponse(403, { error: 'This place is not assigned to you.' });
      targets = targets.filter(it => it.fields.WorkStatus !== 'Completed');
      if (!targets.length) return jsonResponse(400, { error: 'This place is already completed.' });
    } else {
      const match = assignmentRows.find(it => it.fields && (it.fields.Category || '') === b.category && (it.fields.ServiceName || '') === b.serviceName);
      if (!match) return jsonResponse(404, { error: 'This service is not scheduled yet.' });
      /* Solo el/los tecnico(s) YA asignado(s) a este servicio en
         particular lo puede marcar -- mismo candado real que ya aplica
         employee.html para filtrar que ve (get-my-orders.js), revisado
         otra vez aqui del lado del servidor. */
      if (!mine(match)) return jsonResponse(403, { error: 'This service is not assigned to you.' });
      if (match.fields.WorkStatus === 'Completed') return jsonResponse(400, { error: 'This service is already completed.' });
      targets = [match];
    }

    await Promise.all(targets.map(t => updateListItemByItemId(SERVICE_ASSIGNMENTS_LIST, t.id, { WorkStatus: 'Pending Review' })));
    await createListItem(ORDER_HISTORY_LIST, {
      Title: b.orderId + '-svc-done-by-tech-' + Date.now(),
      OrderID: b.orderId,
      ChangeType: 'Service Marked Done By Tech',
      ChangedBy: myName,
      ChangeDate: new Date().toISOString(),
      Notes: '',
      NewValue: JSON.stringify(placeMode
        ? { serviceName: b.category, services: targets.map(t => t.fields.ServiceName) }
        : { serviceName: b.serviceName })
    });

    return jsonResponse(200, { success: true, orderId: b.orderId });
  } catch (err) {
    console.error('submit-service-complete.js error:', err);
    return jsonResponse(500, { error: err.message });
  }
};
