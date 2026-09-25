/* ============================================================
   login-tech.js — inicio de sesion. Nombre + apellido (sin importar
   mayusculas/minusculas ni espacios de mas) + los ultimos 4 digitos
   del telefono (TempID). Nunca el PayrollID -- ese es un dato aparte.
============================================================ */

const { TECHS_LIST, graphFetch, siteListPath, updateListItemByItemId, jsonResponse } = require('./lib/graph');

/* B10 (25/09/2026, decision del dueño): limite de intentos, igual que el
   portal del cliente. 5 errores seguidos con el mismo nombre -> esa
   cuenta queda bloqueada 1 hora. Se guarda en la fila de Techs
   (LoginFailCount, LoginLockedUntil); si esas columnas todavia no
   existen, el login sigue funcionando como antes, sin limite. */
const MAX_FAILS = 5;
const LOCK_MS = 60 * 60 * 1000;
const lockedUntil = f => { const t = f && f.LoginLockedUntil ? new Date(f.LoginLockedUntil).getTime() : 0; return t > Date.now() ? t : 0; };
async function patchQuiet(id, fields) {
  try { await updateListItemByItemId(TECHS_LIST, id, fields); } catch (e) { console.warn('login-tech: could not save attempt count (' + e.message + ')'); }
}
const { sessionCookie, withCookie } = require('./lib/tech-auth');

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
    const firstName = String(b.firstName || '').trim().toLowerCase();
    const lastName = String(b.lastName || '').trim().toLowerCase();
    const tempId = String(b.tempId || '').trim();

    if (!firstName || !lastName || !tempId) {
      return jsonResponse(400, { error: 'Please enter your name and phone digits.' });
    }

    const rows = await fetchAll(TECHS_LIST);
    const byName = rows.filter(it => it.fields
      && String(it.fields.FirstName || '').trim().toLowerCase() === firstName
      && String(it.fields.LastName || '').trim().toLowerCase() === lastName);
    if (byName.some(it => lockedUntil(it.fields))) {
      return jsonResponse(429, { error: 'Too many tries. Please wait an hour or ask the office for help.' });
    }
    const match = byName.find(it => String(it.fields.TempID || '') === tempId);

    if (!match) {
      /* Nombre correcto, digitos mal: cuenta el intento en esa(s) fila(s). */
      await Promise.all(byName.map(it => {
        const fails = (parseInt(it.fields.LoginFailCount, 10) || 0) + 1;
        return patchQuiet(it.id, fails >= MAX_FAILS
          ? { LoginFailCount: 0, LoginLockedUntil: new Date(Date.now() + LOCK_MS).toISOString() }
          : { LoginFailCount: fails });
      }));
      return jsonResponse(404, { error: 'We could not find an account with that name and phone digits.' });
    }
    if (parseInt(match.fields.LoginFailCount, 10) > 0) await patchQuiet(match.id, { LoginFailCount: 0 });
    if (match.fields.Active === false || match.fields.Active === 'false') {
      return jsonResponse(403, { error: 'This account is inactive. Please contact the office.' });
    }

    return withCookie(jsonResponse(200, {
      success: true,
      tech: {
        id: match.id,
        firstName: match.fields.FirstName,
        lastName: match.fields.LastName,
        role: match.fields.Role || 'Employee',
        division: match.fields.Division || '',
        tempId: match.fields.TempID,
        language: match.fields.Language || ''
      }
    }), sessionCookie(match));
  } catch (e) {
    return jsonResponse(500, { error: e.message });
  }
};
