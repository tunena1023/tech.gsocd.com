/* ============================================================
   get-my-history.js — ordenes ya cerradas (Completed/Cancelled) con
   su historial completo. Mismo criterio de alcance que Active Orders:
   Employee ve solo lo suyo, Supervisor ve todo su departamento.
============================================================ */

const {
  ORDERS_LIST, ORDER_SERVICES_LIST, ORDER_HISTORY_LIST, SCHEDULING_LIST, TECHS_LIST,
  jsonResponse
} = require('./lib/graph');

const CLOSED_STATUSES = ['Completed', 'Cancelled'];
/* Velocidad (25/09/2026): antes se bajaban TODAS las ordenes, TODO el
   historial y TODOS los servicios de la empresa en cada apertura. Ahora
   solo las ordenes cerradas, y el historial/servicios de ESAS ordenes
   (lib/list-query.js, con plan B a la lista completa si un filtro falla). */
const lq = require('./lib/list-query');
const techScope = require('./lib/tech-scope');

/* 26/09/2026 (pedido del dueño: "a excepcion de eventos internos, todo
   lo que tenga informacion debe ser visible"): antes aqui se escondian
   las solicitudes (Change Requested, Reschedule Requested...) para que
   el tecnico solo viera lo ya aprobado. Ahora se ven, con su detalle;
   solo se quita lo interno de oficina (Office Change (Internal) y
   'Order Approved'), mismo criterio que lib/order-waiting.js. */
const HIDDEN_HISTORY_TYPES = ['Document Generated', 'Document Failed', 'Archived'];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  try {
    const b = JSON.parse(event.body || '{}');
    const techId = String(b.techId || '').trim();
    const role = String(b.role || '').trim();
    const division = String(b.division || '').trim();
    if (!techId || !role) return jsonResponse(400, { error: 'techId and role are required' });

    const closed = lq.statusIn(CLOSED_STATUSES);
    const [orderRows, myTechRow] = await Promise.all([
      lq.fetchWhere(ORDERS_LIST, closed.filter, closed.test),
      role === 'Employee' ? lq.fetchById(TECHS_LIST, techId) : Promise.resolve(null)
    ]);

    let closedOrders = orderRows.filter(it => it.fields && CLOSED_STATUSES.includes(it.fields.Status));

    if (role === 'Developer') {
      /* Ve todo -- mismo criterio que get-my-orders.js. */
    } else if (role === 'Supervisor') {
      /* Mismo fix que get-my-orders.js: Mixed = las 3 divisiones. */
      if (division.toLowerCase() !== 'mixed') {
        closedOrders = closedOrders.filter(it => String(it.fields.Division || '').toLowerCase() === division.toLowerCase());
      }
    } else {
      /* Mismo arreglo que get-my-orders.js: Admin guarda la asignacion
         real en Scheduling con el PayrollNumber del tecnico, nunca en
         OrderAssignments/TechID (esa lista nunca se llena en el flujo
         normal). */
      /* C14: Scheduling + asignaciones por servicio (lib/tech-scope). */
      const myOrderIds = await techScope.employeeOrderIds(techId, myTechRow);
      closedOrders = closedOrders.filter(it => myOrderIds.has(it.fields.OrderID || it.fields.Title));
    }

    const closedIds = closedOrders.map(it => it.fields.OrderID || it.fields.Title);
    const [svcRows, histRows] = await Promise.all([
      lq.fetchByValues(ORDER_SERVICES_LIST, 'OrderID', closedIds),
      lq.fetchByValues(ORDER_HISTORY_LIST, 'OrderID', closedIds)
    ]);

    const historyByOrder = {};
    histRows.forEach(it => {
      if (!it.fields || !it.fields.OrderID) return;
      if ((it.fields.FieldChanged || '') === 'Office Change (Internal)') return;
      if ((it.fields.ChangeType || '') === 'Order Approved') return;
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

    /* Servicios por orden -- mismo agrupado que ya se hace con el
       historial, para no repetir una llamada aparte por cada tarjeta. */
    const servicesByOrder = {};
    svcRows.forEach(it => {
      if (!it.fields || !it.fields.OrderID) return;
      (servicesByOrder[it.fields.OrderID] = servicesByOrder[it.fields.OrderID] || []).push({
        Category: it.fields.Category || '',
        ServiceName: it.fields.ServiceName || '',
        SubOption: it.fields.SubOption || '',
        Level: it.fields.Level || '',
        Quantity: it.fields.Quantity || '',
        NotCompleted: it.fields.NotCompleted === true || String(it.fields.NotCompleted) === 'true',
        NotCompletedReason: it.fields.NotCompletedReason || ''
      });
    });

    const orders = closedOrders.map(it => {
      const f = it.fields;
      const oid = f.OrderID || f.Title || '';
      const hist = (historyByOrder[oid] || []).sort((a, b) => String(a.ChangeDate).localeCompare(String(b.ChangeDate)));
      return {
        /* Mismo criterio que get-my-orders.js -- ver ahi para el detalle. */
        createdDateTime: it.createdDateTime || '',
        OrderID: oid,
        ClientID: f.ClientID || '',
        BusinessName: f.BusinessName || f.Title || '',
        Division: f.Division || '',
        Status: f.Status || '',
        EntryDate: f.EntryDate || '',
        DueDate: f.DueDate || '',
        UnitOccupied: f.UnitOccupied === true || f.UnitOccupied === 'true',
        NeedsOfficeAccess: f.NeedsOfficeAccess === true || f.NeedsOfficeAccess === 'true',
        OfficeNeedNotes: f.OfficeNeedNotes || '',
        /* Mismos campos que ya recibe Admin en get-order-detail.js,
           para que el tech pueda pintar el mismo detalle de la orden
           junto al historial (antes no llegaban -- por eso History
           en tech solo mostraba el historial solo). */
        Address: f.Address || '',
        Suite: f.Suite || '',
        City: f.City || '',
        Zip: f.Zip || '',
        Contact: f.Contact || '',
        Supervisor: f.Supervisor || '',
        CompletedDate: f.CompletedDate || '',
        BuildingNumber: f.BuildingNumber || '',
        UnitNumber: f.UnitNumber || '',
        Bedrooms: f.Bedrooms || '',
        Bathrooms: f.Bathrooms || '',
        ServiceWindow: f.ServiceWindow || '',
        Notes: f.Notes || '',
        Services: servicesByOrder[oid] || [],
        History: hist
      };
    }).sort((a, b) => String(b.EntryDate).localeCompare(String(a.EntryDate)));

    return jsonResponse(200, { orders });
  } catch (e) {
    return jsonResponse(500, { error: e.message });
  }
};
