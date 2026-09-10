/* ============================================================
   submit-recurring-update.js — el supervisor encontro en sitio que
   la visita de un contrato recurrente necesita otros servicios de
   los que trae el contrato (quito algo, con nota obligatoria;
   agrego algo del catalogo). Mismo patron EXACTO que ya usa
   submit-supervisor-update.js para ordenes normales:

   Es una SUGERENCIA, nunca se aplica sola. Crea un renglon en
   RecurringLog con Status "Pending Review" -- eso es lo unico que
   pasa aqui. La oficina lo ve en el mismo tab Review de siempre
   (badge "Recurring Change"), y decide Approve/Reject desde ahi
   (developer-admin.js, accion decide-recurring-review).

   Solo Supervisor -- un Employee normal no puede desviarse de
   servicios (confirmado con el usuario: "no pasa nada, ellos deben
   de hablar" -- si algo paso, avisan, oficina decide).

   No se llama al API de Admingsocd.com (dominio distinto) -- se
   escribe directo a SharePoint, mismo patron que ya usa cada repo
   por su cuenta.
============================================================ */

const {
  RECURRING_SERVICES_LIST, RECURRING_LOG_LIST, TECHS_LIST,
  createListItem, updateListItemByItemId, graphFetch, siteListPath, jsonResponse
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
    const services = Array.isArray(b.services) ? b.services : [];
    const removedNotes = Array.isArray(b.removedNotes) ? b.removedNotes : [];
    const notes = String(b.notes || '').trim();

    if (!recurringServiceId) return jsonResponse(400, { error: 'recurringServiceId is required' });
    if (!visitDate) return jsonResponse(400, { error: 'visitDate is required' });
    if (!techId) return jsonResponse(400, { error: 'techId is required' });
    if (role !== 'Supervisor') return jsonResponse(403, { error: 'Only a supervisor can report a service change for a recurring visit.' });
    if (!services.length && !removedNotes.length) return jsonResponse(400, { error: 'Nothing was changed.' });
    /* Cada quitado necesita su nota -- mismo requisito obligatorio
       que ya exige el patron de supervisor.html para ordenes. */
    if (removedNotes.some(r => !r.note || !String(r.note).trim())) {
      return jsonResponse(400, { error: 'Every removed service needs a note explaining why.' });
    }

    const [techRows, svcRows] = await Promise.all([fetchAll(TECHS_LIST), fetchAll(RECURRING_SERVICES_LIST)]);
    const techRow = techRows.find(t => t.id === techId);
    const techName = techRow && techRow.fields ? (String(techRow.fields.FirstName || '') + ' ' + String(techRow.fields.LastName || '')).trim() : '';
    if (!techName) return jsonResponse(400, { error: 'Could not identify the supervisor reporting this change.' });

    const svc = svcRows.find(it => it.id === recurringServiceId);
    if (!svc || !svc.fields) return jsonResponse(404, { error: 'Recurring contract not found.' });

    const fields = {
      Title: recurringServiceId + '-' + visitDate,
      RecurringServiceID: recurringServiceId,
      VisitDate: visitDate,
      Status: 'Pending Review',
      Source: 'Field',
      LoggedBy: techName,
      PeopleJSON: '[]',
      ServicesJSON: JSON.stringify({ services, removedNotes }),
      Notes: notes
    };

    /* BUG REAL encontrado y arreglado: antes esto creaba un renglon
       nuevo siempre, sin revisar si ya habia uno para ese mismo dia
       -- si un empleado ya habia marcado "Field Confirmed" (sin
       desviacion) y despues el supervisor reporta un cambio para el
       MISMO dia, quedaban 2 renglones sueltos sin que ninguno supiera
       del otro. Ahora, si ya existe cualquier renglon de ese dia
       (Field Confirmed o un Pending Review anterior), se ACTUALIZA
       ese mismo renglon con el detalle de la desviacion, en vez de
       dejar 2 tirados. Si el existente ya es Completed (la oficina ya
       cerro ese dia), se crea uno nuevo aparte -- es una correccion
       a algo ya cerrado, no se reescribe el historial. */
    const logRows = await fetchAll(RECURRING_LOG_LIST);
    const already = logRows.find(it => it.fields &&
      String(it.fields.RecurringServiceID) === recurringServiceId &&
      String(it.fields.VisitDate) === visitDate);

    if (already && already.fields.Status !== 'Completed') {
      await updateListItemByItemId(RECURRING_LOG_LIST, already.id, fields);
    } else {
      await createListItem(RECURRING_LOG_LIST, fields);
    }

    return jsonResponse(200, { success: true, status: 'Pending Review' });
  } catch (e) {
    return jsonResponse(500, { error: e.message });
  }
};
