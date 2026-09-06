/* ============================================================
   login-tech.js — inicio de sesion. Nombre + apellido (sin importar
   mayusculas/minusculas ni espacios de mas) + los ultimos 4 digitos
   del telefono (TempID). Nunca el PayrollID -- ese es un dato aparte.
============================================================ */

const { TECHS_LIST, graphFetch, siteListPath, jsonResponse } = require('./lib/graph');

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
    const match = rows.find(it => it.fields
      && String(it.fields.FirstName || '').trim().toLowerCase() === firstName
      && String(it.fields.LastName || '').trim().toLowerCase() === lastName
      && String(it.fields.TempID || '') === tempId
    );

    if (!match) return jsonResponse(404, { error: 'We could not find an account with that name and phone digits.' });
    if (match.fields.Active === false || match.fields.Active === 'false') {
      return jsonResponse(403, { error: 'This account is inactive. Please contact the office.' });
    }

    return jsonResponse(200, {
      success: true,
      tech: {
        id: match.id,
        firstName: match.fields.FirstName,
        lastName: match.fields.LastName,
        role: match.fields.Role || 'Employee',
        division: match.fields.Division || '',
        tempId: match.fields.TempID
      }
    });
  } catch (e) {
    return jsonResponse(500, { error: e.message });
  }
};
