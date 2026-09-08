/* ============================================================
   report-unit-not-ready.js — el supervisor reporta desde campo que
   la unidad no esta lista para el equipo (Item 18).

   Mas simple que submit-supervisor-update.js: no toca servicios, solo
   marca el delay reason y manda la orden a Review con una nota
   obligatoria. El supervisor NO propone fechas nuevas -- eso lo
   decide la oficina/Admin al revisar. Aplica a las 3 divisiones
   (antes solo existia algo similar para Renovations).

   Mismo criterio ya usado en request-change.js (ordersgsocd.com) para
   el reporte del cliente: DelayReasonType/Notes se aplican YA (es
   solo un aviso), pero el Status pasa a 'Change Requested' para que
   la oficina decida que hacer con las fechas.
============================================================ */

const {
  ORDERS_LIST, ORDER_HISTORY_LIST,
  updateListItemByItemId, createListItem,
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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  try {
    const b = JSON.parse(event.body || '{}');
    const orderId = String(b.orderId || '').trim();
    const actor = String(b.actor || '').trim() || 'Supervisor';
    const note = String(b.note || '').trim();

    if (!orderId) return jsonResponse(400, { error: 'orderId is required' });
    if (!note) return jsonResponse(400, { error: 'Please add a short note explaining why the unit is not ready.' });

    const orderRows = await fetchByOrderId(ORDERS_LIST, orderId);
    const item = orderRows.find(it => it.fields);
    if (!item) return jsonResponse(404, { error: 'Order not found.' });
    const f = item.fields;

    if (LIVE_STATUSES.indexOf(f.Status || '') === -1) {
      return jsonResponse(400, {
        error: 'This order is not in a state that can be reported right now (status: ' + (f.Status || '') + ').'
      });
    }

    const oldStatus = f.Status || '';
    await updateListItemByItemId(ORDERS_LIST, item.id, {
      Status: 'Change Requested',
      DelayReasonType: 'Site not ready',
      DelayReasonNotes: note
    });

    await createListItem(ORDER_HISTORY_LIST, {
      OrderID: orderId, ChangedBy: actor, ChangeDate: new Date().toISOString(),
      Title: orderId + '-notready', ChangeType: 'Change Requested', FieldChanged: 'Delay Reason',
      Notes: 'Reported by ' + actor + ' (field supervisor): ' + note,
      OldValue: oldStatus, NewValue: 'Change Requested'
    });

    return jsonResponse(200, { success: true, status: 'Change Requested' });
  } catch (e) {
    return jsonResponse(500, { error: e.message });
  }
};
