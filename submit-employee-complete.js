/* ============================================================
   submit-employee-complete.js — el empleado marca SU PARTE como
   terminada, desde su portal (nunca desde Admin).

   YA NO completa la orden de verdad -- eso quedo confirmado que solo
   lo hace la oficina, con su propio boton en Active. Esto solo pone
   una marca (TechMarkedComplete=true, Technician=<nombre>) y deja un
   renglon en el historial -- el boton "Completed" en Active se pone
   azul en vez de verde para avisar que el tecnico ya dijo que
   termino, pero el Status real NO cambia aqui, y no se genera PDF.

   La marca se quita sola en cuanto la orden recibe cualquier cambio
   despues (admin-update-order.js/submit-order.js del lado de Admin y
   Orders) -- si algo cambio, ya no es cierto que "el tecnico termino
   exactamente esto".

   Requisito de negocio: el frontend NO debe llamar esto sin que el
   empleado ya haya tomado al menos una foto de la orden primero
   (se valida aqui tambien del lado del servidor, revisando que ya
   exista al menos una foto en la carpeta de esta orden -- ver
   ensurePhotoExists).

   No se llama al API de otro dominio -- se escribe directo a
   SharePoint, mismo patron que ya usa cada repo por su cuenta.
============================================================ */

const {
  ORDERS_LIST, ORDER_HISTORY_LIST, TECHS_LIST,
  createListItem, updateListItemByItemId,
  graphFetch, siteListPath, listChildren, jsonResponse
} = require('./lib/graph');

const LIVE_STATUSES = ['Assigned', 'Updated'];
const PHOTOS_FOLDER = process.env.GRAPH_PHOTOS_FOLDER || 'TechPhotos';

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

/* Misma carpeta que arma upload-photo.js -- si esta vacia (o no
   existe), el empleado nunca tomo una foto de esta orden. */
async function hasAnyPhoto(clientId, businessName, orderId) {
  const clientLabel = (String(clientId || '').trim() + ' - ' + String(businessName || '').trim())
    .replace(/[\\/:*?"<>|]/g, '').trim() || orderId;
  const folderPath = PHOTOS_FOLDER + '/' + clientLabel + '/' + orderId + '/Photos';
  try {
    const children = await listChildren(folderPath);
    return (children || []).length > 0;
  } catch (e) {
    return false; /* la carpeta no existe todavia -- cero fotos */
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  try {
    const b = JSON.parse(event.body || '{}');
    const orderId = String(b.orderId || '').trim();
    const techId = String(b.techId || '').trim();
    const role = String(b.role || '').trim();
    if (!orderId) return jsonResponse(400, { error: 'orderId is required' });
    if (!techId) return jsonResponse(400, { error: 'techId is required' });

    const [orderRows, techRows] = await Promise.all([
      fetchByOrderId(ORDERS_LIST, orderId),
      (async () => {
        const url = siteListPath(TECHS_LIST) + '?$expand=fields&$top=1000';
        const data = await graphFetch(url);
        return data.value || [];
      })()
    ]);
    const item = orderRows.find(it => it.fields);
    if (!item) return jsonResponse(404, { error: 'Order not found.' });
    const f = item.fields;

    if (LIVE_STATUSES.indexOf(f.Status || '') === -1) {
      return jsonResponse(400, {
        error: 'This order is not in a state that can be marked done right now (status: ' + (f.Status || '') + ').'
      });
    }

    const techRow = techRows.find(t => t.id === techId);
    const techName = techRow && techRow.fields ? (techRow.fields.FirstName + ' ' + techRow.fields.LastName).trim() : '';
    if (!techName) return jsonResponse(400, { error: 'Could not identify the technician completing this order.' });

    /* Un Supervisor ve TODAS las ordenes de su division (para dar
       seguimiento general), pero solo puede marcar las que tiene
       asignadas a su propio nombre -- confirmado con el usuario. Un
       Employee siempre marca lo suyo (get-my-orders.js ya solo le
       muestra sus propias ordenes, no hace falta este chequeo ahi). */
    if (role === 'Supervisor' &&
        String(f.Supervisor || '').trim().toLowerCase() !== techName.toLowerCase()) {
      return jsonResponse(403, { error: 'You can only mark your own assigned orders as done.' });
    }

    const hasPhoto = await hasAnyPhoto(f.ClientID, f.BusinessName, orderId);
    if (!hasPhoto) {
      return jsonResponse(400, { error: 'Take at least one photo of the finished work before marking this order done.' });
    }

    try {
      await updateListItemByItemId(ORDERS_LIST, item.id, { TechMarkedComplete: true, Technician: techName });
    } catch (patchErr) {
      /* Respaldo si TechMarkedComplete todavia no existe como columna
         en SharePoint -- al menos deja el nombre del tecnico. */
      await updateListItemByItemId(ORDERS_LIST, item.id, { Technician: techName });
    }

    await createListItem(ORDER_HISTORY_LIST, {
      OrderID: orderId, ChangedBy: techName, ChangeDate: new Date().toISOString(),
      Title: orderId + '-tech-marked-done', ChangeType: 'Tech Marked Complete', FieldChanged: 'TechMarkedComplete',
      Notes: techName + ' marked their work as done. The office still needs to confirm and close the order.',
      OldValue: 'false', NewValue: 'true'
    });

    return jsonResponse(200, { success: true, techMarkedComplete: true });
  } catch (e) {
    return jsonResponse(500, { error: e.message });
  }
};

