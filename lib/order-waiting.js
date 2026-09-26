/* ============================================================
   lib/order-waiting.js -- una orden que ya estaba en campo y ahora
   espera a la oficina (o al cliente) SIGUE en Tech.

   Pedido del dueño (26/09/2026): "cuando un tecnico hace Update
   Services, en cuanto manda la orden a admin la orden desaparece de
   tech y no puede ver nada. La idea es que SIEMPRE puedan ver lo que
   esta pasando, incluso si no tienen opciones". Se pueden subir fotos,
   y el supervisor puede mandar mas cambios a su propia solicitud
   mientras la oficina contesta.

   Solo cuentan las ordenes que ESTABAN en campo (Assigned/Updated)
   antes de la solicitud -- una orden nueva que el cliente cambia antes
   de que la oficina la programe nunca llego a Tech y no tiene por que
   aparecer ahora. Eso se lee del renglon de historial que abrio la
   solicitud (OldValue trae el estatus de antes, texto o JSON).

   Usado por get-my-orders.js y submit-supervisor-update.js.
============================================================ */

const LIVE_STATUSES = ['Assigned', 'Updated'];
const WAITING_STATUSES = ['Change Requested', 'Cancellation Requested', 'Inspected'];

/* Renglones que abren una solicitud (el mas reciente manda). */
const OPENING_TYPES = ['Change Requested', 'Cancellation Requested', 'Reschedule Requested',
  'Change Requested by Client', 'Services Change Requested', 'Service Change Requested'];

/* Lo que nunca le aporta nada al tecnico: ruido de documentos y lo
   interno de oficina (mismo criterio que el modo 'tech' de
   gsocd-shared/order-history). */
const HIDDEN_TYPES = ['Document Generated', 'Document Failed', 'Archived', 'Batch Created', 'Order Approved'];
function isHiddenFromTech(h) {
  if (HIDDEN_TYPES.includes(h.ChangeType || '')) return true;
  if ((h.FieldChanged || '') === 'Office Change (Internal)') return true;
  return false;
}

function rowOf(it) {
  const f = it.fields || it;
  return {
    ChangeDate: f.ChangeDate || it.createdDateTime || '',
    ChangeType: f.ChangeType || '',
    ChangedBy: f.ChangedBy || '',
    Notes: f.Notes || '',
    FieldChanged: f.FieldChanged || '',
    OldValue: f.OldValue || '',
    NewValue: f.NewValue || ''
  };
}

function sortedRows(histItems) {
  return (histItems || []).filter(it => it && (it.fields || it.ChangeType))
    .map(rowOf)
    .sort((a, b) => String(a.ChangeDate).localeCompare(String(b.ChangeDate)));
}

/* Lo que ve el tecnico en el historial. */
function historyForTech(rows) {
  return rows.filter(h => !isHiddenFromTech(h));
}

function parseJson(v) {
  const raw = String(v == null ? '' : v).trim().replace(/^SERVICES:/, '');
  if (raw.charAt(0) !== '{' && raw.charAt(0) !== '[') return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

/* Estatus de antes de una solicitud: texto ('Assigned') o JSON con
   status ({services, status} de Tech, SERVICES:{...,status} de Admin). */
function priorStatusOf(h) {
  const j = parseJson(h.OldValue);
  if (j && !Array.isArray(j)) return String(j.status || '');
  if (j) return '';
  return String(h.OldValue || '');
}

function latestOpening(rows) {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (OPENING_TYPES.includes(rows[i].ChangeType)) return rows[i];
  }
  return null;
}

/* La solicitud abierta es una sugerencia de campo (Update Services). */
function pendingSupervisorUpdate(rows) {
  const h = latestOpening(rows);
  return h && h.ChangeType === 'Change Requested' && h.FieldChanged === 'Supervisor Update' ? h : null;
}

/* ¿Esta orden ya andaba en campo antes de la solicitud? Se busca hacia
   atras el primer renglon de solicitud cuyo estatus de antes no sea
   otra solicitud (una solicitud encima de otra guarda 'Change
   Requested' como "antes"). Sin dato (ej. 'Service Change Requested'
   del cliente, que no guarda estatus): cuenta si ya tiene supervisor,
   porque la oficina solo se lo pone al programarla. */
function wasInField(f, rows) {
  for (let i = rows.length - 1; i >= 0; i--) {
    const h = rows[i];
    if (h.ChangeType !== 'Change Requested' && h.ChangeType !== 'Cancellation Requested') continue;
    const prior = priorStatusOf(h);
    if (!prior || WAITING_STATUSES.includes(prior)) continue;
    return LIVE_STATUSES.includes(prior);
  }
  return !!String(f.Supervisor || '').trim();
}

/* Que se esta esperando, en ingles (i18n.js lo traduce). null si la
   orden no esta esperando nada. */
function waitingInfo(f, rows) {
  const status = f.Status || '';
  if (status === 'Inspected') {
    return { on: 'office', kind: 'inspection', canUpdate: false,
      title: 'Inspection sent to the office',
      text: 'The office will schedule the work. You can still add photos.' };
  }
  if (status !== 'Change Requested' && status !== 'Cancellation Requested') return null;
  const h = latestOpening(rows) || {};
  const byClient = f.ClientID && String(h.ChangedBy || '') === String(f.ClientID);
  if (status === 'Cancellation Requested') {
    return { on: 'office', kind: 'cancel', canUpdate: false,
      title: 'Cancellation requested',
      text: 'The office is reviewing it. Do not start new work on this order. You can still add photos.' };
  }
  if (h.ChangeType === 'Change Requested' && h.FieldChanged === 'Client Confirmation') {
    return { on: 'client', kind: 'client-confirm', canUpdate: false,
      title: 'Waiting on the client',
      text: 'The office sent a change for the client to confirm. You can still add photos.' };
  }
  if (h.ChangeType === 'Change Requested' && h.FieldChanged === 'Supervisor Update') {
    return { on: 'office', kind: 'update', canUpdate: true, by: h.ChangedBy || '',
      title: 'Service update sent to the office',
      text: 'You can keep adding photos and send more service changes while you wait.' };
  }
  if (h.ChangeType === 'Change Requested' && h.FieldChanged === 'Delay Reason') {
    return { on: 'office', kind: 'notready', canUpdate: false,
      title: 'Unit not ready was reported',
      text: 'The office will decide what happens next. You can still add photos.' };
  }
  if (byClient) {
    return { on: 'office', kind: 'client', canUpdate: false,
      title: 'The client asked for a change',
      text: 'The office is reviewing it. See the history below. You can still add photos.' };
  }
  return { on: 'office', kind: 'office', canUpdate: false,
    title: 'The office is reviewing a change',
    text: 'See the history below. You can still add photos.' };
}

module.exports = {
  LIVE_STATUSES, WAITING_STATUSES,
  sortedRows, historyForTech, pendingSupervisorUpdate, wasInField, waitingInfo, parseJson
};
