/* Simulacion (sin SharePoint real): "Mark my part done" por dia
   (26/09/2026). Correr: node tests/day-done.sim.js */
const graph = require('../lib/graph');
const DB = {}; let nextId = 1; let files = [];
const L = n => (DB[n] = DB[n] || []);
const add = (list, fields) => { const it = { id: String(nextId++), fields: Object.assign({}, fields) }; L(list).push(it); return it; };
graph.siteListPath = n => '/L/' + n + '/items';
graph.graphFetch = async (url) => {
  const m = /^\/L\/([^/]+)\/items\??(.*)$/.exec(url); const [, list, qs] = m;
  const fm = /\$filter=([^&]*)/.exec(qs); let rows = L(list);
  if (fm) { const c = /fields\/(\w+) eq '(.*)'/.exec(decodeURIComponent(fm[1])); rows = rows.filter(it => String(it.fields[c[1]]) === c[2]); }
  return { value: rows };
};
graph.listChildren = async () => files;
graph.createListItem = async (list, f) => add(list, f);
graph.updateListItemByItemId = async (list, id, patch) => Object.assign(L(list).find(x => x.id === id).fields, patch);
require('../lib/notify').notifyOffice = async () => {};
const h = require('../submit-service-complete').handler;
const call = async b => { const r = await h({ httpMethod: 'POST', body: JSON.stringify(b) }); return { status: r.statusCode, body: JSON.parse(r.body) }; };
let ok = 0, fail = 0; const check = (n, c, x) => { if (c) { ok++; console.log('OK  ', n); } else { fail++; console.log('FAIL', n, JSON.stringify(x)); } };
(async () => {
  add('Techs', { FirstName: 'Ana', LastName: 'Lopez' });           // id 1
  add('Techs', { FirstName: 'Beto', LastName: 'Ruiz' });           // id 2
  add('Orders', { OrderID: 'GS-9', ClientID: 'C-1', BusinessName: 'Oak', AssignByService: true, Status: 'Assigned' });
  const A = (svc, who, day, st) => add('ServiceAssignments', { OrderID: 'GS-9', Category: 'Commercial', ServiceName: svc, AssignedTo: who, ScheduledDate: day, WorkStatus: st || 'Not Started' });
  A('Carpet', 'Ana Lopez', '2026-09-29'); A('Paint', 'Ana Lopez', '2026-09-29'); A('Windows', 'Ana Lopez', '2026-09-30');
  A('Floors', 'Beto Ruiz', '2026-09-29'); A('Doors', 'Ana Lopez, Beto Ruiz', '2026-09-29');
  const W = svc => L('ServiceAssignments').find(x => x.fields.ServiceName === svc).fields.WorkStatus;

  let r = await call({ orderId: 'GS-9', techId: '1', dayMode: true, day: '2026-09-29' });
  check('sin foto ni video de la orden: no se deja', r.status === 400 && /photo or video/.test(r.body.error), r);
  files = [{ name: 'video-2026.mp4', isFile: true }];
  r = await call({ orderId: 'GS-9', techId: '1', dayMode: true, day: '2026-09-29' });
  check('con un VIDEO de la orden (no de cada servicio) si se deja', r.status === 200, r);
  check('marca lo de Ana de ese dia (Carpet, Paint, Doors compartido)', W('Carpet') === 'Pending Review' && W('Paint') === 'Pending Review' && W('Doors') === 'Pending Review');
  check('no toca el otro dia de Ana (Windows)', W('Windows') === 'Not Started');
  check('no toca lo de Beto (Floors)', W('Floors') === 'Not Started');
  const hist = L('OrderHistory').slice(-1)[0].fields;
  check('historial: un solo evento con los servicios del dia', hist.ChangeType === 'Service Marked Done By Tech' && JSON.parse(hist.NewValue).services.length === 3, hist);
  r = await call({ orderId: 'GS-9', techId: '1', dayMode: true, day: '2026-09-29' });
  check('otra vez el mismo dia: ya no queda nada', r.status === 400, r);
  r = await call({ orderId: 'GS-9', techId: '2', dayMode: true, day: '2026-09-30' });
  check('Beto no tiene nada el 30', r.status === 400, r);
  r = await call({ orderId: 'GS-9', techId: '1', dayMode: true, day: 'x' });
  check('dia invalido', r.status === 400, r);
  r = await call({ orderId: 'GS-9', techId: '1', category: 'Commercial', serviceName: 'Windows' });
  check('el modo por servicio de antes sigue igual (pide foto de ese servicio)', r.status === 400 && /this service/.test(r.body.error), r);
  /* --- Supervisor/Developer marcan la parte de OTRO, con nota --- */
  require('../lib/tech-scope').check = async () => ({ ok: true });
  add('Techs', { FirstName: 'Juan', LastName: 'Perez' });          // id 13 (supervisor)
  const supId = L('Techs').find(t => t.fields.FirstName === 'Juan').id;
  A('Tiles', 'Beto Ruiz', '2026-10-01'); A('Walls', 'Beto Ruiz', '2026-10-01');
  r = await call({ orderId: 'GS-9', techId: supId, role: 'Supervisor', dayMode: true, day: '2026-10-01', forAssignedTo: 'Beto Ruiz' });
  check('lo de otro sin nota: no se deja', r.status === 400 && /note/.test(r.body.error), r);
  r = await call({ orderId: 'GS-9', techId: '1', role: 'Employee', dayMode: true, day: '2026-10-01', forAssignedTo: 'Beto Ruiz', note: 'he left early' });
  check('un empleado no puede marcar lo de otro', r.status === 403, r);
  r = await call({ orderId: 'GS-9', techId: supId, role: 'Supervisor', dayMode: true, day: '2026-10-01', forAssignedTo: 'Beto Ruiz', note: 'Beto forgot to mark it' });
  check('supervisor con nota: se deja', r.status === 200, r);
  check('marca solo lo de Beto ese dia', W('Tiles') === 'Pending Review' && W('Walls') === 'Pending Review' && W('Floors') === 'Not Started');
  const hb = L('OrderHistory').slice(-1)[0].fields;
  check('historial: quien, para quien y la nota', hb.ChangedBy === 'Juan Perez' && /for Beto Ruiz by Juan Perez: Beto forgot/.test(hb.Notes), hb);
  r = await call({ orderId: 'GS-9', techId: supId, role: 'Developer', dayMode: true, day: '2026-09-29', forAssignedTo: 'Beto Ruiz', note: 'testing on phone' });
  check('developer con nota tambien (Floors de Beto el 29)', r.status === 200 && W('Floors') === 'Pending Review', r);

  /* --- Orden completa de otro (submit-employee-complete) --- */
  const ec = require('../submit-employee-complete').handler;
  const call2 = async b => { const x = await ec({ httpMethod: 'POST', body: JSON.stringify(b) }); return { status: x.statusCode, body: JSON.parse(x.body) }; };
  add('Orders', { OrderID: 'GS-10', ClientID: 'C-1', BusinessName: 'Oak', Status: 'Assigned', Supervisor: 'Pedro Diaz' });
  r = await call2({ orderId: 'GS-10', techId: supId, role: 'Supervisor' });
  check('orden de otro supervisor sin nota: no se deja', r.status === 400 && /note/.test(r.body.error), r);
  r = await call2({ orderId: 'GS-10', techId: supId, role: 'Supervisor', note: 'Pedro is out sick' });
  check('orden de otro con nota: se deja', r.status === 200, r);
  const he = L('OrderHistory').slice(-1)[0].fields;
  check('historial de la orden: nota y para quien', /done for Pedro Diaz: Pedro is out sick/.test(he.Notes), he);
  add('Orders', { OrderID: 'GS-11', ClientID: 'C-1', BusinessName: 'Oak', Status: 'Assigned', Supervisor: 'Juan Perez' });
  r = await call2({ orderId: 'GS-11', techId: supId, role: 'Supervisor' });
  check('su propia orden: sin nota, como siempre', r.status === 200, r);

  console.log('\n' + ok + ' OK, ' + fail + ' FAIL'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
