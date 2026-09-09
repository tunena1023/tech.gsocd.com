/* ============================================================
   device-auth.js — acceso sin login por QR, confirmado con el
   usuario: la oficina genera el QR y lo escanea CON el celular del
   empleado, ahi mismo en persona. 3 acciones:

   verify-setup    -- el SetupToken (del QR) trae que tecnico es,
                       para mostrar "Hi, <nombre>" antes de confirmar.
   activate-device -- al confirmar "This Is Me": crea el DeviceToken
                       PERMANENTE (el que se guarda en localStorage
                       del celular para siempre), apaga cualquier
                       device anterior de ese mismo tecnico (uno solo
                       activo a la vez), y marca el SetupToken usado
                       (no se puede reclamar 2 veces).
   verify-device   -- se llama en CADA apertura de la app (no solo al
                       "iniciar sesion" como el login viejo) -- si el
                       tecnico se desactivo desde Developer, esto lo
                       corta de inmediato aunque su DeviceToken siga
                       guardado en el celular.
============================================================ */

const {
  TECHS_LIST, TECH_DEVICE_TOKENS_LIST,
  createListItem, updateListItemByItemId, graphFetch, siteListPath, jsonResponse
} = require('./lib/graph');

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

function truthy(v) { return v === true || v === 'true' || v === 1 || v === '1'; }

function techSessionShape(techRow) {
  const f = techRow.fields;
  return {
    id: techRow.id,
    firstName: f.FirstName || '',
    lastName: f.LastName || '',
    role: f.Role || 'Employee',
    division: f.Division || '',
    tempId: f.TempID || ''
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  try {
    const b = JSON.parse(event.body || '{}');
    const action = b.action;

    if (action === 'verify-setup') {
      const setupToken = String(b.setupToken || '').trim();
      if (!setupToken) return jsonResponse(400, { error: 'Missing setup link.' });

      const [deviceRows, techRows] = await Promise.all([fetchAll(TECH_DEVICE_TOKENS_LIST), fetchAll(TECHS_LIST)]);
      const setupRow = deviceRows.find(it => it.fields && it.fields.SetupToken === setupToken);
      if (!setupRow) return jsonResponse(404, { error: 'This link is not valid. Please ask the office for a new one.' });
      if (truthy(setupRow.fields.SetupTokenUsed)) return jsonResponse(409, { error: 'This link was already used. Please ask the office for a new one.' });

      const techRow = techRows.find(it => it.id === String(setupRow.fields.TechId || ''));
      if (!techRow) return jsonResponse(404, { error: 'Could not find that account. Please ask the office for a new link.' });

      return jsonResponse(200, { firstName: techRow.fields.FirstName || '', lastName: techRow.fields.LastName || '' });
    }

    if (action === 'activate-device') {
      const setupToken = String(b.setupToken || '').trim();
      if (!setupToken) return jsonResponse(400, { error: 'Missing setup link.' });

      const [deviceRows, techRows] = await Promise.all([fetchAll(TECH_DEVICE_TOKENS_LIST), fetchAll(TECHS_LIST)]);
      const setupRow = deviceRows.find(it => it.fields && it.fields.SetupToken === setupToken);
      if (!setupRow) return jsonResponse(404, { error: 'This link is not valid. Please ask the office for a new one.' });
      if (truthy(setupRow.fields.SetupTokenUsed)) return jsonResponse(409, { error: 'This link was already used. Please ask the office for a new one.' });

      const techId = String(setupRow.fields.TechId || '');
      const techRow = techRows.find(it => it.id === techId);
      if (!techRow) return jsonResponse(404, { error: 'Could not find that account. Please ask the office for a new link.' });
      if (techRow.fields.Active === false || techRow.fields.Active === 'false') {
        return jsonResponse(403, { error: 'This account is inactive. Please contact the office.' });
      }

      /* Un solo dispositivo activo por tecnico -- este nuevo apaga
         cualquier otro que ya estuviera activo (celular viejo deja
         de servir en cuanto se confirma el nuevo, no antes). */
      const otherActive = deviceRows.filter(it =>
        it.fields && String(it.fields.TechId || '') === techId && it.id !== setupRow.id && truthy(it.fields.Active));
      const deviceToken = require('crypto').randomBytes(24).toString('hex');
      const now = new Date().toISOString();

      await Promise.all([
        updateListItemByItemId(TECH_DEVICE_TOKENS_LIST, setupRow.id, {
          SetupTokenUsed: true, DeviceToken: deviceToken, Active: true, LastUsedDate: now
        }),
        ...otherActive.map(it => updateListItemByItemId(TECH_DEVICE_TOKENS_LIST, it.id, { Active: false }))
      ]);

      return jsonResponse(200, { success: true, deviceToken, tech: techSessionShape(techRow) });
    }

    if (action === 'verify-device') {
      const deviceToken = String(b.deviceToken || '').trim();
      if (!deviceToken) return jsonResponse(400, { error: 'Missing device token.' });

      const [deviceRows, techRows] = await Promise.all([fetchAll(TECH_DEVICE_TOKENS_LIST), fetchAll(TECHS_LIST)]);
      const deviceRow = deviceRows.find(it => it.fields && it.fields.DeviceToken === deviceToken);
      if (!deviceRow || !truthy(deviceRow.fields.Active)) {
        return jsonResponse(403, { error: 'This device was disconnected. Please visit the office for a new QR code.' });
      }

      const techRow = techRows.find(it => it.id === String(deviceRow.fields.TechId || ''));
      if (!techRow) return jsonResponse(404, { error: 'Could not find that account. Please contact the office.' });
      if (techRow.fields.Active === false || techRow.fields.Active === 'false') {
        return jsonResponse(403, { error: 'This account is inactive. Please contact the office.' });
      }

      try { await updateListItemByItemId(TECH_DEVICE_TOKENS_LIST, deviceRow.id, { LastUsedDate: new Date().toISOString() }); } catch (e) { /* no bloquea el acceso si esto falla */ }
      return jsonResponse(200, { tech: techSessionShape(techRow) });
    }

    return jsonResponse(400, { error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse(500, { error: err.message });
  }
};
