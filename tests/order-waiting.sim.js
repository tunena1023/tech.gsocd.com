/* Simulacion (sin SharePoint real) del flujo del dueño, 26/09/2026:
   el supervisor manda Update Services, la orden NO desaparece de Tech,
   puede mandar mas cambios, y el historial trae el detalle.
   Correr: node tests/order-waiting.sim.js */
const path = require('path');
const graph = require('../lib/graph');
const DB = {}; let nextId = 1;
const L = n => (DB[n] = DB[n] || []);
function add(list, fields) { const it = { id: String(nextId++), createdDateTime: new Date(Date.now() + nextId).toISOString(), fields: Object.assign({}, fields) }; L(list).push(it); return it; }
graph.siteListPath = n => '/L/' + n + '/items';
graph.graphFetch = async (url) => {
  const m = /^\/L\/([^/]+)\/items(?:\/([^?]+))?\??(.*)$/.exec(url);
  if (!m) throw new Error('bad url ' + url);
  const [, list, id, qs] = m;
  if (id) { const it = L(list).find(x => x.id === decodeURIComponent(id)); if (!it) { const e = new Error('404'); e.status = 404; throw e; } return it; }
  const fm = /\$filter=([^&]*)/.exec(qs);
  let rows = L(list);
  if (fm) {
    const conds = decodeURIComponent(fm[1]).split(' or ').map(c => /fields\/(\w+) eq '(.*)'/.exec(c)).filter(Boolean);
    rows = rows.filter(it => conds.some(c => String(it.fields[c[1]]) === c[2].replace(/''/g, "'")));
  }
  return { value: rows };
};
graph.createListItem = async (list, fields) => add(list, fields);
graph.updateListItemByItemId = async (list, id, patch) => { const it = L(list).find(x => x.id === id); Object.assign(it.fields, patch); return it; };
require('../lib/tech-scope').check = async () => ({ ok: true });

const getMyOrders = require('../get-my-orders').handler;
const supUpdate = require('../submit-supervisor-update').handler;
const notReady = require('../report-unit-not-ready').handler;
const call = async (h, body) => { const r = await h({ httpMethod: 'POST', body: JSON.stringify(body) }); return { status: r.statusCode, body: JSON.parse(r.body) }; };

let ok = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) { ok++; console.log('OK  ', name); } else { fail++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); } };

(async () => {
  add('Techs', { FirstName: 'Juan', LastName: 'Perez', Division: 'Janitorial', PayrollID: 'P1', Active: true });
  const sup = { techId: '1', role: 'Supervisor', division: 'Janitorial' };
  add('Orders', { OrderID: 'GS-1', Title: 'GS-1', ClientID: 'C-100', BusinessName: 'Oak Ridge', Division: 'Janitorial', Status: 'Assigned', Supervisor: 'Juan Perez' });
  add('OrderServices', { OrderID: 'GS-1', Category: 'Commercial', ServiceName: 'Carpet', SubOption: '110-1', Level: 'Level 2' });
  add('OrderServices', { OrderID: 'GS-1', Category: 'Commercial', ServiceName: 'Windows', SubOption: '110-2', Level: '' });
  /* Orden nueva (Pending) que el cliente cambia antes de programarse: nunca estuvo en campo. */
  add('Orders', { OrderID: 'GS-2', Title: 'GS-2', ClientID: 'C-100', BusinessName: 'Oak Ridge', Division: 'Janitorial', Status: 'Change Requested' });
  add('OrderHistory', { OrderID: 'GS-2', ChangeType: 'Change Requested', FieldChanged: 'Status', ChangedBy: 'C-100', ChangeDate: '2026-09-25T10:00:00Z', OldValue: 'Pending', NewValue: 'Change Requested' });
  add('OrderHistory', { OrderID: 'GS-1', ChangeType: 'Order Assigned', ChangedBy: 'Ana', ChangeDate: '2026-09-25T09:00:00Z', NewValue: JSON.stringify({ supervisor: 'Juan Perez' }) });
  add('OrderHistory', { OrderID: 'GS-1', ChangeType: 'Order Approved', FieldChanged: 'Status', ChangedBy: 'Ana', ChangeDate: '2026-09-25T09:00:01Z' });

  let r = await call(getMyOrders, sup);
  check('antes: GS-1 visible y sin espera', r.body.orders.some(o => o.OrderID === 'GS-1' && !o.Waiting), r.body);
  check('GS-2 (nunca en campo) no aparece', !r.body.orders.some(o => o.OrderID === 'GS-2'));
  check('Order Approved (interno) no llega al historial de Tech', !r.body.orders[0].History.some(h => h.ChangeType === 'Order Approved'));

  /* 1er Update Services: Carpet L2->L3, quita Windows. */
  r = await call(supUpdate, { orderId: 'GS-1', actor: 'Juan Perez',
    services: [{ Category: 'Commercial', ServiceName: 'Carpet', SubOption: '110-1', Level: 'Level 3' }],
    removalNotes: [{ serviceName: 'Windows', note: 'already clean' }] });
  check('1er update aceptado', r.status === 200, r.body);

  r = await call(getMyOrders, sup);
  let o = r.body.orders.find(x => x.OrderID === 'GS-1');
  check('despues del update: la orden SIGUE en Tech', !!o);
  check('trae Waiting de update, se puede seguir cambiando', o && o.Waiting && o.Waiting.kind === 'update' && o.Waiting.canUpdate, o && o.Waiting);
  check('PendingServices = lo propuesto', o && o.PendingServices && o.PendingServices.length === 1 && o.PendingServices[0].Level === 'Level 3', o && o.PendingServices);
  check('los servicios reales no cambiaron', o && o.Services.length === 2);
  check('el historial trae la solicitud (antes se escondia)', o && o.History.some(h => h.FieldChanged === 'Supervisor Update'));

  /* 2o Update Services mientras espera: agrega Paint. */
  r = await call(supUpdate, { orderId: 'GS-1', actor: 'Juan Perez',
    services: [{ Category: 'Commercial', ServiceName: 'Carpet', SubOption: '110-1', Level: 'Level 3' }, { Category: 'Commercial', ServiceName: 'Paint', SubOption: '222-5', Level: '', Quantity: 1 }],
    removalNotes: [] });
  check('2o update (en espera) aceptado', r.status === 200, r.body);
  const sups = L('OrderHistory').filter(it => it.fields.OrderID === 'GS-1' && it.fields.FieldChanged === 'Supervisor Update');
  const last = sups[sups.length - 1].fields;
  const lastOld = JSON.parse(last.OldValue);
  check('el 2o guarda como "antes" lo ORIGINAL (2 servicios) y estatus Assigned', lastOld.services.length === 2 && lastOld.status === 'Assigned', lastOld);
  check('el 2o trae la propuesta completa', JSON.parse(last.NewValue).length === 2);
  check('la nota de Windows se conserva para la oficina', /Removed Windows: already clean/.test(last.Notes), last.Notes);

  /* Unit not ready con la orden en espera: no se deja (no se encima). */
  r = await call(notReady, { orderId: 'GS-1', note: 'x', actor: 'Juan Perez' });
  check('Unit not ready bloqueado mientras espera', r.status === 400);

  /* Cliente pide cambio en una orden en campo -> se ve pero sin Update. */
  add('Orders', { OrderID: 'GS-3', Title: 'GS-3', ClientID: 'C-100', BusinessName: 'Oak Ridge', Division: 'Janitorial', Status: 'Change Requested', Supervisor: 'Juan Perez' });
  add('OrderHistory', { OrderID: 'GS-3', ChangeType: 'Change Requested', FieldChanged: 'Status', ChangedBy: 'C-100', ChangeDate: '2026-09-25T11:00:00Z', OldValue: 'Assigned', NewValue: 'Change Requested', Notes: 'Please come Friday' });
  r = await call(getMyOrders, sup);
  o = r.body.orders.find(x => x.OrderID === 'GS-3');
  check('solicitud del cliente: visible, sin Update Services', o && o.Waiting && o.Waiting.kind === 'client' && !o.Waiting.canUpdate, o && o.Waiting);
  r = await call(supUpdate, { orderId: 'GS-3', actor: 'Juan Perez', services: [{ Category: 'Commercial', ServiceName: 'Carpet' }] });
  check('Update Services no se encima sobre la solicitud del cliente', r.status === 400);

  /* Cambio interno de oficina: la orden se ve en espera, pero el renglon interno no. */
  add('Orders', { OrderID: 'GS-4', Title: 'GS-4', ClientID: 'C-100', BusinessName: 'Oak Ridge', Division: 'Janitorial', Status: 'Change Requested', Supervisor: 'Juan Perez' });
  add('OrderHistory', { OrderID: 'GS-4', ChangeType: 'Change Requested', FieldChanged: 'Office Change (Internal)', ChangedBy: 'Ana', ChangeDate: '2026-09-25T11:00:00Z',
    OldValue: 'SERVICES:' + JSON.stringify({ services: [], fields: { supervisor: 'Juan Perez' }, status: 'Updated' }), NewValue: 'SERVICES:' + JSON.stringify({ services: [], fields: { supervisor: 'Pedro' } }) });
  r = await call(getMyOrders, sup);
  o = r.body.orders.find(x => x.OrderID === 'GS-4');
  check('cambio interno: orden visible en espera', o && o.Waiting && o.Waiting.kind === 'office', o && o.Waiting);
  check('cambio interno: el renglon interno no llega a Tech', o && !o.History.length, o && o.History);

  require('fs').writeFileSync(process.env.SAMPLE_OUT || '/dev/null', JSON.stringify(await call(getMyOrders, sup)).slice(0), 'utf8');
  console.log('\n' + ok + ' OK, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
