/* ============================================================
   submit-inspection-done.js — el supervisor termino la inspeccion
   (25/09/2026, pedido del dueño).

   La oficina escogio "Inspection first" en Approvals (Status
   'Inspection', InspectionBy = el supervisor). Aqui el supervisor manda
   lo que encontro:
     { orderId, notes, services?, removalNotes?, crew? }
   - notes: lo que vio (va a Orders.InspectionNotes).
   - services: solo si propone cambios. NO se aplican: igual que
     "Supervisor Update", viven en el renglon de historial hasta que la
     oficina los apruebe (o los mande al cliente) desde Approvals.
   - crew: a quien propone para hacer el trabajo (nombres). Es una
     sugerencia para Scheduling; las fechas las pone la oficina.

   Terminar la inspeccion NO completa la orden: pasa a 'Inspected' y
   se queda en Approvals.

   Candado: solo el supervisor asignado (InspectionBy) o un Developer.
   Quien es sale de la cookie firmada (api/[...slug].js), no del body.
============================================================ */

const {
  ORDERS_LIST, ORDER_SERVICES_LIST, ORDER_HISTORY_LIST,
  createListItem, updateListItemByItemId, listChildren,
  graphFetch, siteListPath, jsonResponse
} = require('./lib/graph');
const graph = require('./lib/graph');
const { notifyOffice } = require('./lib/notify');

const PHOTOS_FOLDER = process.env.GRAPH_PHOTOS_FOLDER || 'TechPhotos';

async function fetchByOrderId(listName, orderId) {
  const filter = encodeURIComponent(`fields/OrderID eq '${String(orderId).replace(/'/g, "''")}'`);
  let url = siteListPath(listName) + `?$expand=fields&$top=200&$filter=${filter}`;
  const out = [];
  while (url) {
    const data = await graphFetch(url, { headers: { Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly' } });
    out.push(...(data.value || []));
    url = data['@odata.nextLink'] || null;
  }
  return out;
}

const svcKey = s => [s.ServiceName, s.Level || '', String(s.Quantity || '')].map(x => String(x).trim().toLowerCase()).join('|');

/* true si la lista propuesta es distinta a la actual (nombre, nivel,
   cantidad; el orden no importa). */
function servicesDiffer(current, proposed) {
  const a = current.map(svcKey).sort();
  const b = proposed.map(svcKey).sort();
  return a.length !== b.length || a.some((k, i) => k !== b[i]);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  try {
    const b = JSON.parse(event.body || '{}');
    const orderId = String(b.orderId || '').trim();
    const actor = String(b.actor || '').trim() || 'Supervisor';
    const role = String(b.role || '');
    const notes = String(b.notes || '').trim().slice(0, 4000);
    const proposed = Array.isArray(b.services) ? b.services : null;
    const removalNotes = Array.isArray(b.removalNotes) ? b.removalNotes : [];
    const crew = Array.isArray(b.crew) ? b.crew.map(n => String(n).trim()).filter(Boolean).slice(0, 30) : [];

    if (!orderId) return jsonResponse(400, { error: 'orderId is required' });
    if (proposed && !proposed.length) return jsonResponse(400, { error: 'An order needs at least one service.' });

    const [orderRows, svcRows] = await Promise.all([
      fetchByOrderId(ORDERS_LIST, orderId),
      fetchByOrderId(ORDER_SERVICES_LIST, orderId)
    ]);
    const item = orderRows.find(it => it.fields);
    if (!item) return jsonResponse(404, { error: 'Order not found.' });
    const f = item.fields;

    if (f.Status !== 'Inspection') {
      return jsonResponse(400, { error: 'This order is not waiting for an inspection (status: ' + (f.Status || '') + ').' });
    }
    if (role !== 'Developer' && String(f.InspectionBy || '').trim().toLowerCase() !== actor.toLowerCase()) {
      return jsonResponse(403, { error: 'This inspection is assigned to ' + (f.InspectionBy || 'someone else') + '.' });
    }

    const current = svcRows.filter(it => it.fields).map(it => ({
      Category: it.fields.Category || '', ServiceName: it.fields.ServiceName || '', SubOption: it.fields.SubOption || '',
      Division: it.fields.Division || f.Division || '', Level: it.fields.Level || '', Quantity: it.fields.Quantity || ''
    }));
    const changes = !!proposed && servicesDiffer(current, proposed);
    const now = new Date().toISOString();

    await updateListItemByItemId(ORDERS_LIST, item.id, {
      Status: 'Inspected', InspectionDoneAt: now, InspectionNotes: notes
    });

    const histRows = await fetchByOrderId(ORDER_HISTORY_LIST, orderId);
    const prefix = orderId + '-insp';
    let count = histRows.filter(it => String(it.fields?.Title || '').indexOf(prefix) === 0).length;

    /* Un solo renglon: 'Inspected'. Si hay cambios, OldValue/NewValue
       llevan el mismo formato que "Supervisor Update" para que Admin
       reuse el mismo diff; crew va en NewValue junto a los servicios. */
    const removed = removalNotes.map(r => 'Removed ' + (r.serviceName || '') + ': ' + (r.note || '')).join(' | ');
    await createListItem(ORDER_HISTORY_LIST, {
      OrderID: orderId,
      ChangedBy: actor,
      ChangeDate: now,
      Title: prefix + (++count),
      ChangeType: 'Inspected',
      FieldChanged: changes ? 'Inspection Update' : 'Inspection',
      Notes: [notes, removed].filter(Boolean).join(' | ') || ('Inspection done by ' + actor + '.'),
      OldValue: changes ? JSON.stringify({ services: current, status: 'Inspection' }) : '',
      NewValue: JSON.stringify(changes ? { services: proposed, crew } : { crew })
    });

    let photoCount = 0;
    try {
      const clientLabel = (String(f.ClientID || '').trim() + ' - ' + String(f.BusinessName || '').trim()).replace(/[\\/:*?"<>|]/g, '').trim() || orderId;
      const kids = await listChildren(PHOTOS_FOLDER + '/' + clientLabel + '/' + orderId + '/Photos');
      photoCount = (kids || []).filter(k => String(k.name || '').indexOf('insp-') === 0).length;
    } catch (e) { /* sin carpeta = sin fotos */ }

    await notifyOffice(graph, {
      event: 'inspection-done',
      order: Object.assign({}, f, { OrderID: orderId }),
      tech: actor, at: now, notes, changes, crew, photoCount
    });

    return jsonResponse(200, { success: true, status: 'Inspected', changes });
  } catch (e) {
    return jsonResponse(500, { error: e.message });
  }
};
