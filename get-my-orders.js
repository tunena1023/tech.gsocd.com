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
  TECHS_LIST, RECURRING_SERVICES_LIST, RECURRING_ASSIGNMENTS_LIST, CLIENTS_LIST,
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

    const [orderRows, svcRows, assignRows, techRows, recurringServiceRows, recurringAssignRows, clientRows] = await Promise.all([
      fetchAll(ORDERS_LIST),
      fetchAll(ORDER_SERVICES_LIST),
      role === 'Employee' ? fetchAll(ORDER_ASSIGNMENTS_LIST) : Promise.resolve([]),
      fetchAll(TECHS_LIST),
      fetchAll(RECURRING_SERVICES_LIST),
      fetchAll(RECURRING_ASSIGNMENTS_LIST),
      fetchAll(CLIENTS_LIST)
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
        UnitOccupied: f.UnitOccupied === true || f.UnitOccupied === 'true',
        NeedsOfficeAccess: f.NeedsOfficeAccess === true || f.NeedsOfficeAccess === 'true',
        OfficeNeedNotes: f.OfficeNeedNotes || '',
        Services: servicesByOrder[oid] || []
      };
    }).sort((a, b) => String(a.DispatchDate || a.EntryDate).localeCompare(String(b.DispatchDate || b.EntryDate)));

    /* Recurrentes -- trabajos fijos de Janitorial que no generan una
       Orden real ni pasan por Scheduling, pero SI cuentan como
       trabajo asignado. Employee ve solo los suyos (por PayrollID,
       cruzando su propio renglon en Techs); Supervisor ve todos los
       de su division, igual que ya hace con las ordenes normales. */
    const myTech = techRows.find(it => it.id === techId);
    const myPayrollId = myTech && myTech.fields ? String(myTech.fields.PayrollID || '').trim() : '';

    const businessNameByClient = {};
    clientRows.forEach(it => {
      if (it.fields && it.fields.ClientID) businessNameByClient[it.fields.ClientID] = it.fields.Title || it.fields.BusinessName || it.fields.ClientID;
    });

    const todayISO = new Date().toISOString().slice(0, 10);
    const activeServices = recurringServiceRows.filter(it => {
      if (!it.fields || it.fields.Active === false || it.fields.Active === 'false') return false;
      if (it.fields.ExpirationDate && String(it.fields.ExpirationDate).slice(0, 10) < todayISO) return false;
      return true;
    });

    /* ServicesJSON: [{sku, serviceName, level}] -- mismo formato
       exacto que arma recurring.html al guardar. */
    function parseServicesJson(raw) {
      try {
        const arr = JSON.parse(raw || '[]');
        return Array.isArray(arr) ? arr.map(s => ({ ServiceName: s.serviceName || s.sku || '', Level: s.level || '' })) : [];
      } catch (e) { return []; }
    }

    let recurring;
    if (role === 'Supervisor') {
      recurring = activeServices
        .filter(it => String(it.fields.Division || '').toLowerCase() === division.toLowerCase())
        .map(it => ({
          id: it.id,
          clientId: it.fields.ClientID || '',
          businessName: businessNameByClient[it.fields.ClientID] || it.fields.ClientID || '',
          buildingNumber: it.fields.BuildingNumber || '',
          division: it.fields.Division || '',
          daysOfWeek: it.fields.DaysOfWeek || '',
          time: it.fields.Time || '',
          totalHours: Number(it.fields.TotalHours) || 0,
          Services: parseServicesJson(it.fields.ServicesJSON)
        }));
    } else {
      const activeServiceIds = new Set(activeServices.map(it => it.id));
      recurring = recurringAssignRows
        .filter(a => a.fields && String(a.fields.PayrollNumber || '').trim() === myPayrollId && activeServiceIds.has(a.fields.RecurringServiceID))
        .map(a => {
          const svc = activeServices.find(it => it.id === a.fields.RecurringServiceID);
          const sf = svc ? svc.fields : {};
          return {
            id: svc ? svc.id : a.fields.RecurringServiceID,
            clientId: sf.ClientID || '',
            businessName: businessNameByClient[sf.ClientID] || sf.ClientID || '',
            buildingNumber: sf.BuildingNumber || '',
            division: sf.Division || '',
            daysOfWeek: sf.DaysOfWeek || '',
            time: sf.Time || '',
            hoursAllocated: Number(a.fields.HoursAllocated) || 0,
            Services: parseServicesJson(sf.ServicesJSON)
          };
        });
    }

    return jsonResponse(200, { orders, recurring });
  } catch (e) {
    return jsonResponse(500, { error: e.message });
  }
};
