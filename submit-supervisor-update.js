/* ============================================================
   submit-supervisor-update.js — el supervisor encontro en sitio que
   la orden necesita otros servicios/niveles de los que se pidieron.

   Misma logica de guardado que el modo "SOLICITUD" de
   admin-update-order.js (Admingsocd.com): los servicios nuevos se
   aplican YA (igual que un cambio del cliente), se guarda un snapshot
   de antes/despues en el historial, y el Status pasa a
   'Change Requested' -- la orden se va a Review, esperando que la
   oficina decida (aprobar, rechazar, o mandarla al cliente para que
   el confirme via 'Send to Customer').

   FieldChanged: 'Supervisor Update' -- marcador distinto a
   'Office Change'/'Office Change (Internal)'/'Client Confirmation'
   (los que ya usa admin-update-order.js), para que Review lo muestre
   aparte y sepa que viene de campo, no de oficina.

   No se llama al API de Admingsocd.com (son proyectos/dominios
   distintos) -- se escribe directo a SharePoint, mismo patron que ya
   usa cada repo por su cuenta.
============================================================ */

const {
  ORDERS_LIST, ORDER_SERVICES_LIST, ORDER_HISTORY_LIST,
  createListItem, updateListItemByItemId, deleteListItem,
  graphFetch, siteListPath, jsonResponse
} = require('./lib/graph');

const LIVE_STATUSES = ['Assigned', 'Updated'];

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

function truthy(v) {
  return v === true || v === 'true' || v === 1 || v === '1';
}

function snapshotServices(svcRows, division) {
  return svcRows.filter(it => it.fields).map(it => ({
    Category:    it.fields.Category    || '',
    ServiceName: it.fields.ServiceName || '',
    SubOption:   it.fields.SubOption   || '',
    Division:    it.fields.Division    || division,
    Level:       it.fields.Level       || ''
  }));
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  try {
    const b = JSON.parse(event.body || '{}');
    const orderId = String(b.orderId || '').trim();
    const services = Array.isArray(b.services) ? b.services : null;
    const actor = String(b.actor || '').trim() || 'Supervisor';
    const removalNotes = Array.isArray(b.removalNotes) ? b.removalNotes : [];

    if (!orderId) return jsonResponse(400, { error: 'orderId is required' });
    if (!services) return jsonResponse(400, { error: 'services is required' });

    const [orderRows, svcRows] = await Promise.all([
      fetchByOrderId(ORDERS_LIST, orderId),
      fetchByOrderId(ORDER_SERVICES_LIST, orderId)
    ]);
    const item = orderRows.find(it => it.fields);
    if (!item) return jsonResponse(404, { error: 'Order not found.' });
    const f = item.fields;

    if (LIVE_STATUSES.indexOf(f.Status || '') === -1) {
      return jsonResponse(400, {
        error: 'This order is not in a state that can be updated right now (status: ' + (f.Status || '') + ').'
      });
    }

    const division = f.Division || '';
    const oldServices = snapshotServices(svcRows, division);

    /* Aplicar de una vez los servicios nuevos -- igual que hace
       admin-update-order.js, si el director rechaza mas tarde, se
       revierte leyendo el snapshot que se guarda abajo. */
    if (svcRows.length) {
      await Promise.all(svcRows.map(row => deleteListItem(ORDER_SERVICES_LIST, row.id)));
    }
    await Promise.all(services.map(s =>
      createListItem(ORDER_SERVICES_LIST, {
        Title:              s.ServiceName || '',
        OrderID:            orderId,
        Category:           s.Category    || '',
        ServiceName:        s.ServiceName || '',
        SubOption:          s.SubOption   || '',
        Division:           s.Division    || division,
        Level:              s.Level       || '',
        NotCompleted:       false,
        NotCompletedReason: ''
      })
    ));

    await updateListItemByItemId(ORDERS_LIST, item.id, { Status: 'Change Requested' });

    const histRows = await fetchByOrderId(ORDER_HISTORY_LIST, orderId);
    const prefix = orderId + '-sup';
    let count = histRows.filter(it => String(it.fields?.Title || '').indexOf(prefix) === 0).length;

    const notesParts = [];
    if (removalNotes.length) {
      removalNotes.forEach(r => notesParts.push('Removed ' + (r.serviceName || '') + ': ' + (r.note || '')));
    }
    const notes = notesParts.length
      ? notesParts.join(' | ')
      : ('Service update suggested on-site by ' + actor + '.');

    await createListItem(ORDER_HISTORY_LIST, {
      OrderID:      orderId,
      ChangedBy:    actor,
      ChangeDate:   new Date().toISOString(),
      Title:        prefix + (++count),
      ChangeType:   'Change Requested',
      FieldChanged: 'Supervisor Update',
      Notes:        notes,
      OldValue:     JSON.stringify({ services: oldServices, status: f.Status || '' }),
      NewValue:     JSON.stringify(services)
    });

    return jsonResponse(200, { success: true, status: 'Change Requested' });
  } catch (e) {
    return jsonResponse(500, { error: e.message });
  }
};
