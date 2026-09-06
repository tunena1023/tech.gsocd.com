/* ============================================================
   get-my-orders.js — ordenes que un empleado o supervisor puede ver.

   Employee: solo las que tiene asignadas por su nombre en
   OrderAssignments (TechID = su id de Techs).

   Supervisor: TODAS las de su division (Division = su Division en
   Techs), sin necesitar asignacion renglon por renglon -- ve el
   departamento completo.

   En los dos casos, solo cuentan las que ya pasaron por Scheduling de
   verdad (Status Assigned o Updated -- nunca Received, que todavia no
   tiene supervisor/ventana/fecha real).
============================================================ */

const {
  ORDERS_LIST, ORDER_SERVICES_LIST, ORDER_ASSIGNMENTS_LIST,
  graphFetch, siteListPath, jsonResponse
} = require('./lib/graph');

const LIVE_STATUSES = ['Assigned', 'Updated'];

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

    const [orderRows, svcRows, assignRows] = await Promise.all([
      fetchAll(ORDERS_LIST),
      fetchAll(ORDER_SERVICES_LIST),
      role === 'Employee' ? fetchAll(ORDER_ASSIGNMENTS_LIST) : Promise.resolve([])
    ]);

    let liveOrders = orderRows.filter(it => it.fields && LIVE_STATUSES.includes(it.fields.Status));

    if (role === 'Supervisor') {
      liveOrders = liveOrders.filter(it => String(it.fields.Division || '').toLowerCase() === division.toLowerCase());
    } else {
      const myOrderIds = new Set(
        assignRows.filter(it => it.fields && String(it.fields.TechID || '') === techId)
          .map(it => it.fields.OrderID)
      );
      liveOrders = liveOrders.filter(it => myOrderIds.has(it.fields.OrderID || it.fields.Title));
    }

    const servicesByOrder = {};
    svcRows.forEach(it => {
      if (!it.fields) return;
      const oid = it.fields.OrderID;
      if (!oid) return;
      (servicesByOrder[oid] = servicesByOrder[oid] || []).push({
        Category: it.fields.Category || '',
        ServiceName: it.fields.ServiceName || '',
        SubOption: it.fields.SubOption || '',
        Level: it.fields.Level || ''
      });
    });

    const orders = liveOrders.map(it => {
      const f = it.fields;
      const oid = f.OrderID || f.Title || '';
      return {
        id: it.id,
        OrderID: oid,
        ClientID: f.ClientID || '',
        BusinessName: f.BusinessName || f.Title || '',
        Division: f.Division || '',
        Status: f.Status || '',
        Supervisor: f.Supervisor || '',
        Address: f.Address || '',
        Suite: f.Suite || '',
        City: f.City || '',
        Zip: f.Zip || '',
        BuildingNumber: f.BuildingNumber || '',
        UnitNumber: f.UnitNumber || '',
        Bedrooms: f.Bedrooms || '',
        Bathrooms: f.Bathrooms || '',
        EntryDate: f.EntryDate || '',
        DueDate: f.DueDate || '',
        ServiceWindow: f.ServiceWindow || '',
        DispatchDate: f.DispatchDate || '',
        MaterialsReady: f.MaterialsReady === true || f.MaterialsReady === 'true',
        EntryTime: f.EntryTime || '',
        Services: servicesByOrder[oid] || []
      };
    }).sort((a, b) => String(a.DispatchDate || a.EntryDate).localeCompare(String(b.DispatchDate || b.EntryDate)));

    return jsonResponse(200, { orders });
  } catch (e) {
    return jsonResponse(500, { error: e.message });
  }
};
