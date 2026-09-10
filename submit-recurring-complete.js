/* ============================================================
   submit-recurring-complete.js — marca una visita de un contrato
   recurrente como hecha, SIN ninguna desviacion de servicios. Lo
   puede usar Employee o Supervisor por igual (a diferencia de
   submit-recurring-update.js, que es exclusivo de Supervisor).

   Mismo patron de 2 pasos que ya usa una orden normal
   (TechMarkedComplete): esto NO cierra nada -- crea un renglon en
   Status "Field Confirmed". La oficina (developer-admin.js,
   accion mark-recurring-visit-complete) es quien de verdad lo
   finaliza a "Completed" -- ese endpoint vive en Admingsocd.com,
   dominio aparte, por eso este archivo nunca lo llama, solo
   escribe su propio renglon aqui.

   Sin foto obligatoria a proposito -- confirmado con el usuario,
   las fotos en Recurring son opcionales, a diferencia de una orden
   normal.

   No se llama al API de Admingsocd.com (dominio distinto) -- se
   escribe directo a SharePoint, mismo patron que ya usa cada repo
   por su cuenta.
============================================================ */

const {
  RECURRING_SERVICES_LIST, RECURRING_ASSIGNMENTS_LIST, RECURRING_LOG_LIST, TECHS_LIST,
  createListItem, graphFetch, siteListPath, jsonResponse
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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  try {
    const b = JSON.parse(event.body || '{}');
    const recurringServiceId = String(b.recurringServiceId || '').trim();
    const visitDate = String(b.visitDate || '').trim();
    const techId = String(b.techId || '').trim();
    const role = String(b.role || '').trim();
    if (!recurringServiceId) return jsonResponse(400, { error: 'recurringServiceId is required' });
    if (!visitDate) return jsonResponse(400, { error: 'visitDate is required' });
    if (!techId) return jsonResponse(400, { error: 'techId is required' });

    const [techRows, svcRows, assignRows, logRows] = await Promise.all([
      fetchAll(TECHS_LIST), fetchAll(RECURRING_SERVICES_LIST),
      fetchAll(RECURRING_ASSIGNMENTS_LIST), fetchAll(RECURRING_LOG_LIST)
    ]);

    const techRow = techRows.find(t => t.id === techId);
    const techName = techRow && techRow.fields ? (String(techRow.fields.FirstName || '') + ' ' + String(techRow.fields.LastName || '')).trim() : '';
    if (!techName) return jsonResponse(400, { error: 'Could not identify who is completing this visit.' });
    const myPayrollId = techRow.fields.PayrollID || '';

    const svc = svcRows.find(it => it.id === recurringServiceId);
    if (!svc || !svc.fields) return jsonResponse(404, { error: 'Recurring contract not found.' });

    /* Employee: solo puede marcar lo que tiene asignado a el mismo
       (mismo criterio que ya usa submit-employee-complete.js).
       Supervisor y Developer: sin restriccion -- mismo patron que ya
       usa get-my-orders.js (Developer ve/puede TODO, sin filtro de
       asignacion individual ni de division). BUG REAL: esto se me
       habia olvidado agregar aqui, solo contemplaba Supervisor. */
    if (role === 'Supervisor' || role === 'Developer') {
      // sin candado adicional -- ven todo, sin filtro de asignacion
    } else {
      const assigned = assignRows.some(a => a.fields &&
        String(a.fields.RecurringServiceID) === recurringServiceId &&
        String(a.fields.PayrollNumber || '').trim() === String(myPayrollId).trim());
      if (!assigned) return jsonResponse(403, { error: 'You are not assigned to this recurring contract.' });
    }

    /* BUG REAL encontrado y arreglado: antes CUALQUIER renglon ya
       existente bloqueaba por igual ("alreadyLogged"), sin importar
       su estatus real. Eso escondia el caso real: si un supervisor
       ya mando una desviacion (Pending Review) para hoy, este mark-
       done normal se quedaba callado como si ya no hubiera nada que
       hacer -- cuando en realidad hay algo esperando decision en
       Review.

       Ademas: si hoy ya se mando "Sent Back" (oficina dijo que no
       esta listo), el tecnico debe poder reintentar el mismo dia --
       se crea un renglon NUEVO (Title con sufijo unico) en vez de
       pisar el renglon de Sent Back, para que ese Send Back se quede
       visible en el historial para siempre, no se pierda. Se toma
       el renglon MAS RECIENTE de hoy (no el primero que aparezca)
       para decidir el estatus actual. */
    const todayRows = logRows.filter(it => it.fields &&
      String(it.fields.RecurringServiceID) === recurringServiceId &&
      String(it.fields.VisitDate) === visitDate);
    const already = todayRows.length
      ? todayRows.reduce((a, b) => (new Date(a.createdDateTime) > new Date(b.createdDateTime) ? a : b))
      : null;

    if (already && already.fields.Status === 'Pending Review') {
      return jsonResponse(200, { success: true, pendingReview: true });
    }
    if (already && (already.fields.Status === 'Completed' || already.fields.Status === 'Field Confirmed')) {
      return jsonResponse(200, { success: true, alreadyLogged: true });
    }

    await createListItem(RECURRING_LOG_LIST, {
      Title: recurringServiceId + '-' + visitDate + (already ? '-retry-' + Date.now() : ''),
      RecurringServiceID: recurringServiceId,
      VisitDate: visitDate,
      Status: 'Field Confirmed',
      Source: 'Field',
      LoggedBy: techName,
      PeopleJSON: '[]',
      ServicesJSON: '',
      Notes: ''
    });

    return jsonResponse(200, { success: true });
  } catch (e) {
    return jsonResponse(500, { error: e.message });
  }
};
