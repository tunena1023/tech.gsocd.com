/* ============================================================
   submit-employee-complete.js — el empleado marca su propia orden
   como Completed, desde su portal (nunca desde Admin).

   Requisito de negocio: el frontend NO debe llamar esto sin que el
   empleado ya haya tomado al menos una foto de la orden primero
   (se valida aqui tambien del lado del servidor, revisando que ya
   exista al menos una foto en la carpeta de esta orden -- ver
   ensurePhotoExists).

   Mismo patron de historial que usa admin-update-order.js al marcar
   Completed (Admingsocd.com), para que el timeline se vea identico
   sin importar quien la completo:
     1) ChangeType='Completed', FieldChanged='Status'
     2) ChangeType='Order Details Set', con Technician/CompletedDate

   Tambien regenera el PDF (mismo criterio: CompletedDate es un campo
   de "control" que siempre lo dispara) -- confirmado con el usuario
   que el PDF SI debe reflejar cuando el empleado completa la orden.

   No se llama al API de otro dominio -- se escribe directo a
   SharePoint, mismo patron que ya usa cada repo por su cuenta.
============================================================ */

const {
  ORDERS_LIST, ORDER_SERVICES_LIST, ORDER_HISTORY_LIST, TECHS_LIST,
  createListItem, updateListItemByItemId,
  graphFetch, siteListPath, listChildren, jsonResponse
} = require('./lib/graph');
const { generateAndSaveOrderPdf } = require('./lib/orderpdf');

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

function toIsoDate(d) {
  return new Date(d).toISOString().slice(0, 10);
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
        error: 'This order is not in a state that can be completed right now (status: ' + (f.Status || '') + ').'
      });
    }

    const techRow = techRows.find(t => t.id === techId);
    const techName = techRow && techRow.fields ? (techRow.fields.FirstName + ' ' + techRow.fields.LastName).trim() : '';
    if (!techName) return jsonResponse(400, { error: 'Could not identify the technician completing this order.' });

    const hasPhoto = await hasAnyPhoto(f.ClientID, f.BusinessName, orderId);
    if (!hasPhoto) {
      return jsonResponse(400, { error: 'Take at least one photo of the finished work before marking this order Completed.' });
    }

    const completedDate = toIsoDate(new Date());
    const oldStatus = f.Status || '';

    let patch;
    try {
      patch = { Status: 'Completed', Technician: techName, CompletedDate: completedDate };
      await updateListItemByItemId(ORDERS_LIST, item.id, patch);
    } catch (patchErr) {
      /* Mismo respaldo que admin-update-order.js -- Technician/
         CompletedDate se agregaron a mano en SharePoint, Graph
         rechaza el PATCH completo si la columna no existe todavia. */
      await updateListItemByItemId(ORDERS_LIST, item.id, { Status: 'Completed' });
    }

    const now = new Date().toISOString();
    await createListItem(ORDER_HISTORY_LIST, {
      OrderID: orderId, ChangedBy: techName, ChangeDate: completedDate + 'T12:00:00.000Z',
      Title: orderId + '-completed-status', ChangeType: 'Completed', FieldChanged: 'Status',
      Notes: '', OldValue: oldStatus, NewValue: 'Completed'
    });
    await createListItem(ORDER_HISTORY_LIST, {
      OrderID: orderId, ChangedBy: techName, ChangeDate: now,
      Title: orderId + '-completed-details', ChangeType: 'Order Details Set', FieldChanged: '',
      Notes: 'Technician: ' + techName + ' · Completed Date: ' + completedDate,
      OldValue: '', NewValue: ''
    });

    /* PDF: CompletedDate es un campo de "control" (mismo criterio que
       admin-update-order.js) -- siempre regenera. */
    let pdf = null;
    try {
      const [freshSvc, freshHist] = await Promise.all([
        fetchByOrderId(ORDER_SERVICES_LIST, orderId),
        fetchByOrderId(ORDER_HISTORY_LIST, orderId)
      ]);
      pdf = await generateAndSaveOrderPdf({
        order: Object.assign({}, f, patch, { OrderID: orderId }),
        services: freshSvc.filter(r => r.fields).map(r => r.fields),
        history: freshHist.filter(r => r.fields).map(r => r.fields)
          .sort((a, b) => new Date(a.ChangeDate || 0) - new Date(b.ChangeDate || 0))
      });
    } catch (e) {
      pdf = { ok: false, error: e.message };
    }
    await createListItem(ORDER_HISTORY_LIST, {
      OrderID: orderId, ChangedBy: techName, ChangeDate: new Date().toISOString(),
      Title: orderId + '-completed-doc', ChangeType: pdf.ok ? 'Document Generated' : 'Document Failed',
      FieldChanged: 'Document',
      Notes: pdf.ok ? 'Order document saved. The client will receive it by email.'
                    : ('The order document could not be generated: ' + (pdf.error || '')),
      OldValue: '', NewValue: ''
    });

    return jsonResponse(200, { success: true, status: 'Completed' });
  } catch (e) {
    return jsonResponse(500, { error: e.message });
  }
};
