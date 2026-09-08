/* ============================================================
   get-my-history.js — ordenes ya cerradas (Completed/Cancelled) con
   su historial completo. Mismo criterio de alcance que Active Orders:
   Employee ve solo lo suyo, Supervisor ve todo su departamento.
============================================================ */

const {
  ORDERS_LIST, ORDER_HISTORY_LIST, SCHEDULING_LIST, TECHS_LIST,
  graphFetch, siteListPath, jsonResponse
} = require('./lib/graph');

const CLOSED_STATUSES = ['Completed', 'Cancelled'];

/* El tecnico solo debe ver CORRECCIONES ya confirmadas -- nunca una
   peticion todavia sin decidir. Si un cliente pide un cambio de
   fecha, eso se queda esperando en Review; el tecnico no se entera
   hasta que la oficina lo aprueba (evento 'Dates Confirmed' o
   similar). Estos tipos se filtran aqui mismo, del lado del
   servidor, para que nunca lleguen al frontend por accidente. */
const PENDING_REQUEST_TYPES = [
  'Change Requested', 'Cancellation Requested', 'Reschedule Requested', 'Change Requested by Client'
];
/* Mismo ruido operativo que ya se oculta en Admin (Active/History) --
   confirma que un documento se genero o fallo, no un cambio real de
   la orden. */
const HIDDEN_HISTORY_TYPES = ['Document Generated', 'Document Failed', 'Archived'];

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
    const techId = String(b.techId || '').trim();
    const role = String(b.role || '').trim();
    const division = String(b.division || '').trim();
    if (!techId || !role) return jsonResponse(400, { error: 'techId and role are required' });

    const [orderRows, histRows, schedulingRows, techRows] = await Promise.all([
      fetchAll(ORDERS_LIST),
      fetchAll(ORDER_HISTORY_LIST),
      role === 'Employee' ? fetchAll(SCHEDULING_LIST) : Promise.resolve([]),
      role === 'Employee' ? fetchAll(TECHS_LIST) : Promise.resolve([])
    ]);

    let closedOrders = orderRows.filter(it => it.fields && CLOSED_STATUSES.includes(it.fields.Status));

    if (role === 'Developer') {
      /* Ve todo -- mismo criterio que get-my-orders.js. */
    } else if (role === 'Supervisor') {
      closedOrders = closedOrders.filter(it => String(it.fields.Division || '').toLowerCase() === division.toLowerCase());
    } else {
      /* Mismo arreglo que get-my-orders.js: Admin guarda la asignacion
         real en Scheduling con el PayrollNumber del tecnico, nunca en
         OrderAssignments/TechID (esa lista nunca se llena en el flujo
         normal). */
      const myTechRow = techRows.find(it => it.id === techId);
      const myPayrollId = myTechRow && myTechRow.fields ? String(myTechRow.fields.PayrollID || '').trim() : '';
      const myOrderIds = new Set(
        schedulingRows.filter(it => it.fields && String(it.fields.PayrollNumber || '').trim() === myPayrollId)
          .map(it => it.fields.OrderID)
      );
      closedOrders = closedOrders.filter(it => myOrderIds.has(it.fields.OrderID || it.fields.Title));
    }

    const historyByOrder = {};
    histRows.forEach(it => {
      if (!it.fields || !it.fields.OrderID) return;
      if (PENDING_REQUEST_TYPES.includes(it.fields.ChangeType || '')) return;
      if (HIDDEN_HISTORY_TYPES.includes(it.fields.ChangeType || '')) return;
      (historyByOrder[it.fields.OrderID] = historyByOrder[it.fields.OrderID] || []).push({
        ChangeDate: it.fields.ChangeDate || '',
        ChangeType: it.fields.ChangeType || '',
        ChangedBy: it.fields.ChangedBy || '',
        Notes: it.fields.Notes || '',
        FieldChanged: it.fields.FieldChanged || '',
        OldValue: it.fields.OldValue || '',
        NewValue: it.fields.NewValue || ''
      });
    });

    const orders = closedOrders.map(it => {
      const f = it.fields;
      const oid = f.OrderID || f.Title || '';
      const hist = (historyByOrder[oid] || []).sort((a, b) => String(a.ChangeDate).localeCompare(String(b.ChangeDate)));
      return {
        OrderID: oid,
        BusinessName: f.BusinessName || f.Title || '',
        Division: f.Division || '',
        Status: f.Status || '',
        EntryDate: f.EntryDate || '',
        DueDate: f.DueDate || '',
        UnitOccupied: f.UnitOccupied === true || f.UnitOccupied === 'true',
        NeedsOfficeAccess: f.NeedsOfficeAccess === true || f.NeedsOfficeAccess === 'true',
        OfficeNeedNotes: f.OfficeNeedNotes || '',
        History: hist
      };
    }).sort((a, b) => String(b.EntryDate).localeCompare(String(a.EntryDate)));

    return jsonResponse(200, { orders });
  } catch (e) {
    return jsonResponse(500, { error: e.message });
  }
};
