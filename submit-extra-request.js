/* ============================================================
   submit-extra-request.js — el cliente le pidio al tecnico, en sitio,
   algo que NO esta en su lista del contrato. El tecnico no lo hace por
   su cuenta: lo manda a oficina con una nota, y oficina decide si se
   hace como extra cobrado aparte o si no (resolve-extra-request.js en
   Admingsocd.com). Nace del rediseno de Recurring "Who does what"
   (23/09/2026): al facturar solo "Areas comunes" nadie sabia hasta
   donde llegaba el alcance y se terminaba haciendo de mas sin cobrar.

   SIN lista nueva: un evento 'Extra Requested' en el historial real de
   la orden, con FieldChanged 'Office Change (Internal)' (el componente
   compartido order-history ya lo esconde del cliente). requestId liga
   la solicitud con la respuesta de oficina.
============================================================ */
const {
  ORDERS_LIST, SERVICE_ASSIGNMENTS_LIST, ORDER_HISTORY_LIST, TECHS_LIST,
  createListItem, graphFetch, siteListPath, jsonResponse
} = require('./lib/graph');

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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  try {
    const b = JSON.parse(event.body || '{}');
    for (const k of ['orderId', 'techId', 'note']) if (!b[k] || !String(b[k]).trim()) return jsonResponse(400, { error: k + ' is required' });
    const note = String(b.note).trim().slice(0, 1000);

    const orderRows = await fetchByOrderId(ORDERS_LIST, b.orderId, false);
    const orderItem = orderRows.find(it => it.fields);
    if (!orderItem) return jsonResponse(404, { error: 'Order not found.' });

    const techRows = await (async () => {
      let url = siteListPath(TECHS_LIST) + '?$expand=fields&$top=500';
      const out = [];
      while (url) { const data = await graphFetch(url); out.push(...(data.value || [])); url = data['@odata.nextLink'] || null; }
      return out;
    })();
    const me = techRows.find(it => it.id === b.techId);
    const myName = me && me.fields ? (String(me.fields.FirstName || '') + ' ' + String(me.fields.LastName || '')).trim() : '';
    if (!myName) return jsonResponse(404, { error: 'Technician not found.' });

    /* Solo alguien que de verdad trabaja esta orden: con algun lugar
       asignado, o el Supervisor de la orden. */
    const assignRows = await fetchByOrderId(SERVICE_ASSIGNMENTS_LIST, b.orderId, true);
    const myRows = assignRows.filter(it => it.fields && String(it.fields.AssignedTo || '').split(',').map(n => n.trim()).includes(myName));
    const isSupervisor = String(orderItem.fields.Supervisor || '').trim() === myName;
    if (!myRows.length && !isSupervisor) return jsonResponse(403, { error: 'This order is not assigned to you.' });

    const places = [...new Set(myRows.map(it => it.fields.Category).filter(Boolean))];
    const requestId = b.orderId + '-x' + Date.now();
    await createListItem(ORDER_HISTORY_LIST, {
      Title: b.orderId + '-extra-requested-' + Date.now(),
      OrderID: b.orderId,
      ChangeType: 'Extra Requested',
      FieldChanged: 'Office Change (Internal)',
      ChangedBy: myName,
      ChangeDate: new Date().toISOString(),
      Notes: note,
      NewValue: JSON.stringify({ requestId, note, place: places.length === 1 ? places[0] : '', by: myName })
    });
    return jsonResponse(200, { success: true, requestId });
  } catch (err) {
    console.error('submit-extra-request.js error:', err);
    return jsonResponse(500, { error: err.message });
  }
};
