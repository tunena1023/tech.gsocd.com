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
  console.log('\n' + ok + ' OK, ' + fail + ' FAIL'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
