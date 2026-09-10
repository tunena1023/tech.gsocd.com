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

    /* Modo debug -- se puede borrar cuando ya no haga falta. Regresa
       exactamente lo que el servidor detecto (rol, PayrollID, si
       encontro un renglon de asignacion que haga match), SIN escribir
       nada, para no tener que ir a perseguir columnas en SharePoint a
       mano. */
    if (b.debug) {
      const matchingAssignments = assignRows
        .filter(a => a.fields && String(a.fields.RecurringServiceID) === recurringServiceId)
        .map(a => ({ payrollNumber: a.fields.PayrollNumber, matchesMe: String(a.fields.PayrollNumber || '').trim() === String(myPayrollId).trim() }));
      return jsonResponse(200, {
        debug: true,
        techId, techName,
        roleReceived: role,
        roleWouldBypassCheck: (role === 'Supervisor' || role === 'Developer'),
        myPayrollId,
        recurringServiceId,
        contractFound: true,
        assignmentsForThisContract: matchingAssignments,
        wouldPass: (role === 'Supervisor' || role === 'Developer') || matchingAssignments.some(a => a.matchesMe)
      });
    }

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
       Review. Y si el renglon anterior fue Rejected, ahora si se
       puede volver a marcar limpio (un intento nuevo, no el mismo
       problema de antes). */
    const already = logRows.find(it => it.fields &&
      String(it.fields.RecurringServiceID) === recurringServiceId &&
      String(it.fields.VisitDate) === visitDate);
    if (already && already.fields.Status === 'Pending Review') {
      return jsonResponse(200, { success: true, pendingReview: true });
    }
    if (already && (already.fields.Status === 'Completed' || already.fields.Status === 'Field Confirmed')) {
      return jsonResponse(200, { success: true, alreadyLogged: true });
    }

    await createListItem(RECURRING_LOG_LIST, {
      Title: recurringServiceId + '-' + visitDate,
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
