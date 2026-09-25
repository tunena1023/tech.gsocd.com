/* ============================================================
   lib/tech-scope.js -- "¿esta orden es de este tecnico?" (B11,
   25/09/2026). Antes, subir fotos, mandar cambios de supervisor,
   reportar "unidad no lista" o marcar como terminado solo revisaban que
   la orden existiera: cualquier tecnico con sesion podia hacerlo en
   cualquier orden. Ahora se usa la misma regla con la que la app decide
   que ordenes le ensena a cada quien (sin importar el estatus, para que
   las fotos de History sigan funcionando):

     Developer  -> todas.
     Supervisor -> su division (Mixed = todas), o si es quien inspecciona
                   (InspectionBy), o si su nombre esta en Supervisor.
     Employee / Contractor / otros ->
                   su PayrollID (o "tech:<id>") en Scheduling de esa orden,
                   o su nombre en ServiceAssignments de esa orden,
                   o su nombre en el campo Supervisor de la orden.

   Quien es sale de la cookie (el router pone techId/role/division).
============================================================ */
const lq = require('./list-query');
const { ORDERS_LIST, TECHS_LIST, SCHEDULING_LIST, SERVICE_ASSIGNMENTS_LIST } = require('./graph');

const low = s => String(s || '').trim().toLowerCase();
const names = v => String(v || '').split(',').map(low).filter(Boolean);

/* body: { techId, role, division }. order: fields de la orden (opcional;
   si no viene se busca). -> { ok, error, order } */
async function check(body, orderId, order) {
  const role = String(body.role || '').trim();
  const division = low(body.division);
  if (!order) {
    const rows = await lq.fetchByValues(ORDERS_LIST, 'OrderID', [orderId]);
    const it = rows.find(r => r.fields);
    if (!it) return { ok: false, status: 404, error: 'Order not found.' };
    order = it.fields;
  }
  if (role === 'Developer') return { ok: true, order };

  const me = await lq.fetchById(TECHS_LIST, String(body.techId || ''));
  const myName = me && me.fields ? low((me.fields.FirstName || '') + ' ' + (me.fields.LastName || '')) : '';
  if (myName && names(order.Supervisor).includes(myName)) return { ok: true, order };

  if (role === 'Supervisor') {
    if (division === 'mixed' || low(order.Division) === division) return { ok: true, order };
    if (myName && low(order.InspectionBy) === myName) return { ok: true, order };
    return { ok: false, status: 403, error: 'This order is not in your department.' };
  }

  const keys = [me && me.fields ? String(me.fields.PayrollID || '').trim() : '', 'tech:' + String(body.techId || '')].filter(Boolean).map(low);
  const [sched, sa] = await Promise.all([
    lq.fetchByValues(SCHEDULING_LIST, 'OrderID', [orderId]),
    lq.fetchByValues(SERVICE_ASSIGNMENTS_LIST, 'OrderID', [orderId])
  ]);
  if (sched.some(r => r.fields && keys.includes(low(r.fields.PayrollNumber)))) return { ok: true, order };
  if (myName && sa.some(r => r.fields && names(r.fields.AssignedTo).includes(myName))) return { ok: true, order };
  return { ok: false, status: 403, error: 'This order is not assigned to you.' };
}

/* C14 (25/09/2026): ordenes de un empleado para History / Gallery / Docs.
   Antes solo contaba Scheduling (asignacion de toda la orden), asi que
   quien estaba asignado POR SERVICIO no veia fotos, historial ni
   documentos de esas ordenes. Ahora: Scheduling (PayrollID o
   "tech:<id>") + su nombre en ServiceAssignments -- el mismo criterio de
   su lista de ordenes activas (get-my-orders). -> Set de OrderID */
async function employeeOrderIds(techId, techRow) {
  const me = techRow === undefined ? await lq.fetchById(TECHS_LIST, String(techId || '')) : techRow;
  const pid = me && me.fields ? String(me.fields.PayrollID || '').trim() : '';
  const myName = me && me.fields ? low((me.fields.FirstName || '') + ' ' + (me.fields.LastName || '')) : '';
  const keys = [pid, techId ? 'tech:' + techId : ''].filter(Boolean);
  const [sched, sa] = await Promise.all([
    lq.fetchByValues(SCHEDULING_LIST, 'PayrollNumber', keys),
    myName ? lq.fetchAll(SERVICE_ASSIGNMENTS_LIST) : Promise.resolve([])
  ]);
  const ids = new Set();
  sched.forEach(r => { if (r.fields && r.fields.OrderID) ids.add(r.fields.OrderID); });
  sa.forEach(r => { if (r.fields && r.fields.OrderID && names(r.fields.AssignedTo).includes(myName)) ids.add(r.fields.OrderID); });
  return ids;
}

module.exports = { check, employeeOrderIds };
