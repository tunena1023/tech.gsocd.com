/* ============================================================
   get-recurring-history.js — historial de un contrato recurrente,
   para que Tech lo vea con el MISMO componente compartido real
   (GSOrderHistory) que ya usa Admin y el portal del cliente.

   No se inventa vocabulario nuevo: se reusan las etiquetas que YA
   EXISTEN en el componente --
     'Order Assigned'      -> "Assigned" (snapshot de servicios)
     'Tech Marked Complete'-> "Tech marked their work done"
     'Change Requested'    -> "Change requested" (desviacion pendiente)
     'Change Reassigned'   -> "Change approved"
     'Completed'           -> "Completed"
     'Change Rejected'     -> "Change not approved" (se reusa tanto
                               para un Send Back de una visita normal
                               como para un rechazo de una desviacion
                               -- misma idea de fondo: "no se aprobo")
============================================================ */

const {
  RECURRING_SERVICES_LIST, RECURRING_ASSIGNMENTS_LIST, RECURRING_LOG_LIST, TECHS_LIST,
  graphFetch, siteListPath, jsonResponse
} = require('./lib/graph');

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

function parseServicesJson(raw) {
  try {
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr.map(s => (s.serviceName || s.sku || '') + (s.level ? ' — ' + s.level : '')) : [];
  } catch (e) { return []; }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  try {
    const b = JSON.parse(event.body || '{}');
    const recurringServiceId = String(b.recurringServiceId || '').trim();
    const techId = String(b.techId || '').trim();
    const role = String(b.role || '').trim();
    if (!recurringServiceId) return jsonResponse(400, { error: 'recurringServiceId is required' });
    if (!techId) return jsonResponse(400, { error: 'techId is required' });

    const [techRows, svcRows, assignRows, logRows] = await Promise.all([
      fetchAll(TECHS_LIST), fetchAll(RECURRING_SERVICES_LIST),
      fetchAll(RECURRING_ASSIGNMENTS_LIST), fetchAll(RECURRING_LOG_LIST)
    ]);

    const techRow = techRows.find(t => t.id === techId);
    const myPayrollId = techRow && techRow.fields ? techRow.fields.PayrollID || '' : '';

    const svc = svcRows.find(it => it.id === recurringServiceId);
    if (!svc || !svc.fields) return jsonResponse(404, { error: 'Recurring contract not found.' });

    /* Mismo candado que submit-recurring-complete.js -- Employee solo
       ve el historial de lo que tiene asignado, Supervisor/Developer
       ven cualquiera. */
    if (role !== 'Supervisor' && role !== 'Developer') {
      const assigned = assignRows.some(a => a.fields &&
        String(a.fields.RecurringServiceID) === recurringServiceId &&
        String(a.fields.PayrollNumber || '').trim() === String(myPayrollId).trim());
      if (!assigned) return jsonResponse(403, { error: 'You are not assigned to this recurring contract.' });
    }

    const history = [];

    /* Primer renglon -- no es un evento guardado de verdad (el
       contrato no "nace" cada dia), es un snapshot armado con la
       fecha en que se creo el contrato, para dar contexto de que
       servicios trae. */
    history.push({
      ChangeType: 'Order Assigned',
      ChangeDate: svc.createdDateTime || new Date().toISOString(),
      ChangedBy: 'Office',
      Notes: 'Services: ' + parseServicesJson(svc.fields.ServicesJSON).join(', ')
    });

    const myLogRows = logRows
      .filter(it => it.fields && String(it.fields.RecurringServiceID) === recurringServiceId)
      .sort((a, b) => new Date(a.createdDateTime) - new Date(b.createdDateTime));

    myLogRows.forEach(it => {
      const f = it.fields;
      const when = it.createdDateTime || (f.VisitDate ? f.VisitDate + 'T12:00:00Z' : new Date().toISOString());

      /* El campo marco "hecho" en algun momento si Source es Field --
         sin importar en que Status haya terminado despues (Completed,
         Sent Back, Pending Review todos pudieron nacer de un Field
         Confirmed). */
      if (f.Source === 'Field') {
        history.push({ ChangeType: 'Tech Marked Complete', ChangeDate: when, ChangedBy: f.LoggedBy || '' });
      }
      if (f.Status === 'Pending Review') {
        let svcPayload = {};
        try { svcPayload = JSON.parse(f.ServicesJSON || '{}'); } catch (e) { /* deja vacio */ }
        const parts = [];
        (svcPayload.services || []).forEach(s => parts.push('Added ' + (s.serviceName || '')));
        (svcPayload.removedNotes || []).forEach(r => parts.push('Removed ' + (r.serviceName || '') + ': ' + (r.note || '')));
        history.push({ ChangeType: 'Change Requested', ChangeDate: when, ChangedBy: f.LoggedBy || '', FieldChanged: 'Recurring Update', Notes: parts.join(' | ') });
      }
      if (f.Status === 'Completed') {
        history.push({ ChangeType: 'Completed', ChangeDate: f.ReviewedDate || when, ChangedBy: f.ReviewedBy || f.LoggedBy || 'Office' });
      }
      if (f.Status === 'Sent Back' || f.Status === 'Rejected') {
        history.push({ ChangeType: 'Change Rejected', ChangeDate: f.ReviewedDate || when, ChangedBy: f.ReviewedBy || 'Office', Notes: f.ReviewNotes || '' });
      }
    });

    history.sort((a, b) => new Date(a.ChangeDate) - new Date(b.ChangeDate));

    return jsonResponse(200, { history });
  } catch (e) {
    return jsonResponse(500, { error: e.message });
  }
};
