/* ============================================================
   save-push-subscription.js — guarda la suscripcion de notificaciones
   push de un tecnico (un mismo tecnico puede tener varias, una por
   dispositivo/navegador donde haya dado permiso).

   La suscripcion en si (endpoint + llaves de encripcion) la genera el
   navegador -- este endpoint solo la guarda en SharePoint, ligada al
   PayrollID del tecnico. Admingsocd.com es quien realmente manda las
   notificaciones despues, leyendo esta misma lista.

   action: 'save'   -- guarda/actualiza la suscripcion de este navegador
   action: 'remove' -- se llama si el navegador reporta que la
                       suscripcion ya no es valida (raro, pero pasa si
                       el usuario borra datos del navegador)
============================================================ */

const {
  TECHS_LIST, PUSH_SUBSCRIPTIONS_LIST,
  createListItem, updateListItemByItemId, deleteListItem,
  graphFetch, siteListPath, jsonResponse
} = require('./lib/graph');

async function fetchByField(listName, fieldName, value) {
  const filter = encodeURIComponent(`fields/${fieldName} eq '${String(value).replace(/'/g, "''")}'`);
  const url = siteListPath(listName) + `?$expand=fields&$top=50&$filter=${filter}`;
  const data = await graphFetch(url);
  return data.value || [];
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  try {
    const b = JSON.parse(event.body || '{}');
    const techId = String(b.techId || '').trim();
    const action = String(b.action || 'save').trim();
    const subscription = b.subscription;
    if (!techId) return jsonResponse(400, { error: 'techId is required' });

    const techRows = await (async () => {
      const url = siteListPath(TECHS_LIST) + '?$expand=fields&$top=1000';
      const data = await graphFetch(url);
      return data.value || [];
    })();
    const techRow = techRows.find(t => t.id === techId);
    const payrollId = techRow && techRow.fields ? String(techRow.fields.PayrollID || '').trim() : '';
    if (!payrollId) return jsonResponse(400, { error: 'Could not identify this technician.' });

    if (action === 'remove') {
      if (!subscription || !subscription.endpoint) return jsonResponse(400, { error: 'subscription.endpoint is required' });
      const existing = await fetchByField(PUSH_SUBSCRIPTIONS_LIST, 'Endpoint', subscription.endpoint);
      await Promise.all(existing.map(it => deleteListItem(PUSH_SUBSCRIPTIONS_LIST, it.id)));
      return jsonResponse(200, { success: true });
    }

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return jsonResponse(400, { error: 'A valid subscription object is required' });
    }

    /* Un mismo endpoint (navegador/dispositivo) nunca deberia
       duplicarse -- si ya existia (p. ej. el navegador renovo la
       suscripcion con las mismas llaves), se actualiza en vez de
       crear un renglon nuevo. */
    const existing = await fetchByField(PUSH_SUBSCRIPTIONS_LIST, 'Endpoint', subscription.endpoint);
    const fields = {
      Title: payrollId + ' - ' + new Date().toISOString().slice(0, 10),
      PayrollID: payrollId,
      Endpoint: subscription.endpoint,
      P256dh: subscription.keys.p256dh || '',
      Auth: subscription.keys.auth || ''
    };
    if (existing.length) {
      await updateListItemByItemId(PUSH_SUBSCRIPTIONS_LIST, existing[0].id, fields);
    } else {
      await createListItem(PUSH_SUBSCRIPTIONS_LIST, fields);
    }

    return jsonResponse(200, { success: true });
  } catch (e) {
    return jsonResponse(500, { error: e.message });
  }
};
