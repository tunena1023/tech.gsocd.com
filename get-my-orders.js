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
  ORDERS_LIST, ORDER_SERVICES_LIST, SCHEDULING_LIST, SERVICE_ASSIGNMENTS_LIST,
  TECHS_LIST, RECURRING_SERVICES_LIST, RECURRING_ASSIGNMENTS_LIST, CLIENTS_LIST,
  jsonResponse
} = require('./lib/graph');

const LIVE_STATUSES = ['Assigned', 'Updated'];
/* Velocidad (25/09/2026): antes, cada vez que un tecnico abria la app,
   se bajaban TODAS las ordenes, servicios, clientes, tecnicos, Scheduling
   y asignaciones de la empresa. Ahora solo las ordenes vivas y, de esas,
   sus servicios/asignaciones; lo del tecnico por su PayrollID; y solo los
   clientes de sus recurrentes. lib/list-query.js cae sola a la lista
   completa si un filtro falla, asi que el resultado es el mismo. */
const lq = require('./lib/list-query');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  try {
    const b = JSON.parse(event.body || '{}');
    const techId = String(b.techId || '').trim();
    const role = String(b.role || '').trim();
    const division = String(b.division || '').trim();
    if (!techId || !role) return jsonResponse(400, { error: 'techId and role are required' });

    const wanted = lq.statusIn(LIVE_STATUSES.concat(['Inspection']));
    const [orderRows, techRows, recurringServiceRows] = await Promise.all([
      lq.fetchWhere(ORDERS_LIST, wanted.filter, wanted.test),
      /* Employee: solo su renglon. Supervisor/Developer: todos (crewOptions). */
      role === 'Employee' ? lq.fetchById(TECHS_LIST, techId).then(r => r ? [r] : []) : lq.fetchAllCached(TECHS_LIST),
      lq.fetchAllCached(RECURRING_SERVICES_LIST)
    ]);

    /* PayrollID del empleado logueado -- se necesita ANTES del filtro
       de ordenes de aqui abajo (Scheduling identifica al tecnico por
       PayrollNumber, no por TechID) y tambien mas abajo para los
       Recurrentes -- se calcula una sola vez, aqui arriba. */
    const myTechRow = techRows.find(it => it.id === techId);
    const myPayrollId = myTechRow && myTechRow.fields ? String(myTechRow.fields.PayrollID || '').trim() : '';
    /* "Assign by service" -- ServiceAssignments.AssignedTo guarda
       NOMBRES (texto, coma-separado si hay varios), no PayrollID --
       mismo criterio que ya usa Admingsocd.com para esto. */
    const myName = myTechRow && myTechRow.fields ? (String(myTechRow.fields.FirstName || '') + ' ' + String(myTechRow.fields.LastName || '')).trim() : '';

    /* Asignaciones por servicio de las ordenes vivas (las unicas que
       importan abajo), y lo de Scheduling/recurrentes de este empleado. */
    const candidateIds = orderRows.filter(it => it.fields).map(it => it.fields.OrderID || it.fields.Title);
    const byPayroll = list => myPayrollId
      ? lq.fetchWhere(list, `fields/PayrollNumber eq '${myPayrollId.replace(/'/g, "''")}'`, f => String(f.PayrollNumber || '').trim() === myPayrollId)
      : lq.fetchAll(list);
    const [serviceAssignRows, schedulingRows, recurringAssignRows] = await Promise.all([
      lq.fetchByValues(SERVICE_ASSIGNMENTS_LIST, 'OrderID', candidateIds),
      role === 'Employee' ? byPayroll(SCHEDULING_LIST) : Promise.resolve([]),
      role === 'Employee' ? byPayroll(RECURRING_ASSIGNMENTS_LIST) : Promise.resolve([])
    ]);

    let liveOrders = orderRows.filter(it => it.fields && LIVE_STATUSES.includes(it.fields.Status));
    /* Inspecciones (25/09/2026): una orden en 'Inspection' la ve SOLO el
       supervisor que va a inspeccionar (InspectionBy = su nombre), en
       cualquier division -- y Developer, que ve todo. Se agregan despues
       de los filtros de abajo para que el filtro de division no las tire. */
    const inspectionOrders = orderRows.filter(it => it.fields && it.fields.Status === 'Inspection' &&
      (role === 'Developer' || (role === 'Supervisor' && myName &&
        String(it.fields.InspectionBy || '').trim().toLowerCase() === myName.toLowerCase())));

    if (role === 'Developer') {
      /* Ve TODO -- las 3 divisiones, sin filtro de division ni de
         asignacion individual. Aprobado: un Developer supervisa y
         revisa desde el portal, no hace el trabajo fisico el mismo
         (por eso Mark as Completed sigue exigiendo que sea SU propia
         orden asignada como supervisor, igual que hoy -- ese candado
         vive en el frontend, isMySupervisorOrder, y no cambia aqui). */
    } else if (role === 'Supervisor') {
      /* Mixed = las 3 divisiones (mismo caso que Developer, sin
         filtro) -- antes de este fix, comparar Division de la orden
         contra el string literal "Mixed" nunca coincidia con nada
         (ninguna orden tiene Division="Mixed", solo Janitorial/
         Renovations/Exteriors), asi que un Supervisor Mixed no veia
         NINGUNA orden. Confirmado con el dueno, 17/09/2026. */
      if (division.toLowerCase() !== 'mixed') {
        liveOrders = liveOrders.filter(it => String(it.fields.Division || '').toLowerCase() === division.toLowerCase());
      }
    } else {
      /* Admin (Scheduling en Admingsocd.com) guarda la asignacion real
         en la lista Scheduling con el PayrollNumber del tecnico -- NO
         en OrderAssignments/TechID, que nunca se llena en el flujo
         normal (confirmado: ninguna funcion de Admin escribe ahi). Por
         eso un empleado recien asignado nunca aparecia en su propio
         portal, aunque la asignacion se hubiera guardado bien del
         lado de Admin. */
      const myOrderIds = new Set(
        schedulingRows.filter(it => it.fields && String(it.fields.PayrollNumber || '').trim() === myPayrollId)
          .map(it => it.fields.OrderID)
      );
      /* "Assign by service": una orden asi NUNCA escribe en
         Scheduling (ese es el modelo de toda-la-orden) -- su
         asignacion vive solo en ServiceAssignments, por servicio,
         con AssignedTo como NOMBRE (texto), no PayrollNumber. */
      if (myName) {
        serviceAssignRows.forEach(it => {
          if (!it.fields || !it.fields.AssignedTo) return;
          const names = String(it.fields.AssignedTo).split(',').map(n => n.trim());
          if (names.includes(myName)) myOrderIds.add(it.fields.OrderID);
        });
      }
      liveOrders = liveOrders.filter(it => myOrderIds.has(it.fields.OrderID || it.fields.Title));
    }
    liveOrders = liveOrders.concat(inspectionOrders);

    const svcRows = await lq.fetchByValues(ORDER_SERVICES_LIST, 'OrderID', liveOrders.map(it => it.fields.OrderID || it.fields.Title));

    const servicesByOrder = {};
    svcRows.forEach(it => {
      if (!it.fields) return;
      const oid = it.fields.OrderID;
      if (!oid) return;
      (servicesByOrder[oid] = servicesByOrder[oid] || []).push({
        Category: it.fields.Category || '',
        ServiceName: it.fields.ServiceName || '',
        SubOption: it.fields.SubOption || '',
        Level: it.fields.Level || '',
        Quantity: it.fields.Quantity || ''
      });
    });

    /* "Assign by service" -- agrupado por orden, para no tener que
       filtrar serviceAssignRows completo por cada orden abajo. Un
       Employee solo ve SUS renglones (los que traen su nombre en
       AssignedTo) -- el resto de la orden (otros servicios, quien
       sea que los tenga) no es asunto suyo, mismo criterio que ya
       usa el resto del portal ("solo lo mio"). Supervisor/Developer
       ven todos los renglones de la orden, igual que ya ven todo lo
       demas. */
    const serviceAssignByOrder = {};
    serviceAssignRows.forEach(it => {
      if (!it.fields || !it.fields.OrderID) return;
      (serviceAssignByOrder[it.fields.OrderID] = serviceAssignByOrder[it.fields.OrderID] || []).push(it.fields);
    });

    const orders = liveOrders.map(it => {
      const f = it.fields;
      const oid = f.OrderID || f.Title || '';
      const isAssignByService = f.AssignByService === true || f.AssignByService === 'true';
      const allAssignRows = serviceAssignByOrder[oid] || [];
      const myAssignRows = (role === 'Employee' && myName)
        ? allAssignRows.filter(a => String(a.AssignedTo || '').split(',').map(n => n.trim()).includes(myName))
        : allAssignRows;
      return {
        id: it.id,
        /* Pedido del dueño (18/09/2026): antes no llegaba este dato
           al frontend -- se necesita para mostrar cuando se creo la
           orden en la tarjeta cerrada, sin tener que abrirla. */
        createdDateTime: it.createdDateTime || '',
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
        TechMarkedComplete: f.TechMarkedComplete === true || f.TechMarkedComplete === 'true',
        NeedsOfficeAccess: f.NeedsOfficeAccess === true || f.NeedsOfficeAccess === 'true',
        OfficeNeedNotes: f.OfficeNeedNotes || '',
        Services: servicesByOrder[oid] || [],
        /* Lo que incluia cada paquete el dia de la orden (columna Orders.PackageContents). */
        PackageSnapshots: (() => { try { return JSON.parse(f.PackageContents || '{}') || {}; } catch (e) { return {}; } })(),
        /* "Assign by service" -- AssignByService decide si employee.html
           pinta el modelo por servicio en vez del de siempre.
           MyServiceAssignments son SOLO los renglones de este empleado
           (Employee) o todos (Supervisor/Developer) -- mismo mapeo
           real que ya usa Admin (get-service-assignments.js). */
        AssignByService: isAssignByService,
        /* Recurrentes "Who does what": recurrente + Assign by service =
           orden por lugar (employee.html la pinta por lugar). */
        RecurringServiceID: f.RecurringServiceID || '',
        InspectionBy: f.InspectionBy || '',
        InspectionDate: f.InspectionDate || '',
        InspectionWindow: f.InspectionWindow || '',
        MyServiceAssignments: myAssignRows.map(a => ({
          Category: a.Category || '', ServiceName: a.ServiceName || '', Sequence: a.Sequence != null ? Number(a.Sequence) : null,
          AssignedTo: a.AssignedTo || '', ScheduledDate: a.ScheduledDate || '', WorkStatus: a.WorkStatus || 'Not Started'
        }))
      };
    }).sort((a, b) => String(a.DispatchDate || a.EntryDate).localeCompare(String(b.DispatchDate || b.EntryDate)));

    /* Recurrentes -- trabajos fijos de Janitorial que no generan una
       Orden real ni pasan por Scheduling, pero SI cuentan como
       trabajo asignado. Employee ve solo los suyos (por PayrollID,
       cruzando su propio renglon en Techs); Supervisor ve todos los
       de su division, igual que ya hace con las ordenes normales.
       myPayrollId ya se calculo arriba, junto al filtro de ordenes. */

    /* Solo los clientes de los recurrentes que se van a mostrar. */
    const clientRows = await lq.fetchByValues(CLIENTS_LIST, 'ClientID',
      recurringServiceRows.filter(it => it.fields).map(it => it.fields.ClientID));
    const businessNameByClient = {};
    const addressByClient = {};
    clientRows.forEach(it => {
      if (!it.fields || !it.fields.ClientID) return;
      businessNameByClient[it.fields.ClientID] = it.fields.Title || it.fields.BusinessName || it.fields.ClientID;
      /* Direccion real del cliente -- mismo dato que ya usa Admin
         para Create Order, nunca se invento un campo nuevo. */
      addressByClient[it.fields.ClientID] = [it.fields.Address || '', it.fields.Suite || '', it.fields.City || '', it.fields.Zip || '']
        .filter(Boolean).join(', ');
    });

    /* Cuantos dias faltan para la PROXIMA ocurrencia de este
       contrato (puede ser hoy mismo). null si el contrato no tiene
       ningun dia valido configurado. Confirmado con el usuario: el
       recurrente aparece en Tech desde 3 dias antes de que toque. */
    const DAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    function daysUntilNextOccurrence(daysOfWeekStr) {
      const days = String(daysOfWeekStr || '').split(',').map(d => d.trim()).filter(Boolean);
      if (!days.length) return null;
      const todayIdx = new Date().getDay();
      let min = null;
      days.forEach(d => {
        const idx = DAY_INDEX[d];
        if (idx === undefined) return;
        let diff = idx - todayIdx;
        if (diff < 0) diff += 7;
        if (min === null || diff < min) min = diff;
      });
      return min;
    }
    const RECURRING_VISIBILITY_WINDOW_DAYS = 3;

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
        return Array.isArray(arr) ? arr.map(s => ({ ServiceName: s.serviceName || s.sku || '', Level: s.level || '', Quantity: s.quantity || '' })) : [];
      } catch (e) { return []; }
    }

    let recurring;
    if (role === 'Developer') {
      /* Igual que Supervisor pero sin filtro de division -- ve los
         recurrentes de las 3 divisiones. Sin ventana de 3 dias a
         proposito -- ya veia TODO sin filtro individual, es una
         vista de supervision, no una lista personal de trabajo. */
      recurring = activeServices.map(it => ({
        id: it.id,
        clientId: it.fields.ClientID || '',
        businessName: businessNameByClient[it.fields.ClientID] || it.fields.ClientID || '',
        address: addressByClient[it.fields.ClientID] || '',
        buildingNumber: it.fields.BuildingNumber || '',
        division: it.fields.Division || '',
        daysOfWeek: it.fields.DaysOfWeek || '',
        time: it.fields.Time || '',
        totalHours: Number(it.fields.TotalHours) || 0,
        daysUntil: daysUntilNextOccurrence(it.fields.DaysOfWeek),
        Services: parseServicesJson(it.fields.ServicesJSON)
      }));
    } else if (role === 'Supervisor') {
      /* Mismo fix que arriba (ordenes normales) -- Mixed = las 3
         divisiones, sin filtro. */
      recurring = activeServices
        .filter(it => division.toLowerCase() === 'mixed' || String(it.fields.Division || '').toLowerCase() === division.toLowerCase())
        .map(it => ({
          id: it.id,
          clientId: it.fields.ClientID || '',
          businessName: businessNameByClient[it.fields.ClientID] || it.fields.ClientID || '',
          address: addressByClient[it.fields.ClientID] || '',
          buildingNumber: it.fields.BuildingNumber || '',
          division: it.fields.Division || '',
          daysOfWeek: it.fields.DaysOfWeek || '',
          time: it.fields.Time || '',
          totalHours: Number(it.fields.TotalHours) || 0,
          daysUntil: daysUntilNextOccurrence(it.fields.DaysOfWeek),
          Services: parseServicesJson(it.fields.ServicesJSON)
        }));
    } else {
      /* Employee -- su lista PERSONAL de trabajo. Aqui SI aplica la
         ventana de 3 dias (confirmado con el usuario): sin esto,
         un contrato recurrente se veria clavado ahi todos los dias
         de la semana, incluso cuando no le toca. */
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
            address: addressByClient[sf.ClientID] || '',
            buildingNumber: sf.BuildingNumber || '',
            division: sf.Division || '',
            daysOfWeek: sf.DaysOfWeek || '',
            time: sf.Time || '',
            hoursAllocated: Number(a.fields.HoursAllocated) || 0,
            daysUntil: daysUntilNextOccurrence(sf.DaysOfWeek),
            Services: parseServicesJson(sf.ServicesJSON)
          };
        })
        .filter(r => r.daysUntil !== null && r.daysUntil <= RECURRING_VISIBILITY_WINDOW_DAYS);
    }

    /* Gente que el supervisor puede proponer para el trabajo despues de
       una inspeccion: tecnicos activos de su division (Mixed = todos). */
    const crewOptions = (role === 'Supervisor' || role === 'Developer')
      ? techRows.filter(it => it.fields && it.fields.Active !== false && it.fields.Active !== 'false' &&
          (role === 'Developer' || division.toLowerCase() === 'mixed' ||
            String(it.fields.Division || '').toLowerCase() === division.toLowerCase() || it.fields.Division === 'Mixed'))
        .map(it => (String(it.fields.FirstName || '') + ' ' + String(it.fields.LastName || '')).trim())
        .filter(Boolean).sort()
      : [];
    return jsonResponse(200, { orders, recurring, crewOptions });
  } catch (e) {
    return jsonResponse(500, { error: e.message });
  }
};
