/* ============================================================
   register-tech.js — registro de un empleado o supervisor nuevo.

   TempID: los ultimos 4 digitos del telefono. Es lo unico que se usa
   para iniciar sesion (junto con nombre + apellido) -- el PayrollID
   real lo asigna despues la contadora, y es un dato aparte (para leer
   reportes/scheduling), nunca se usa para el login.

   El rol nunca se auto-selecciona en el registro: todos entran como
   Employee. Pasarlos a Supervisor es una decision de la oficina desde
   el lado admin (pendiente de construir esa pantalla).
============================================================ */

const { TECHS_LIST, createListItem, graphFetch, siteListPath, jsonResponse } = require('./lib/graph');

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

function last4Digits(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.slice(-4);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  try {
    const b = JSON.parse(event.body || '{}');
    const firstName = String(b.firstName || '').trim();
    const lastName = String(b.lastName || '').trim();
    const phone = String(b.phone || '').trim();
    const email = String(b.email || '').trim();
    const division = String(b.division || '').trim();

    if (!firstName || !lastName) return jsonResponse(400, { error: 'First and last name are required.' });
    if (!phone) return jsonResponse(400, { error: 'Phone number is required.' });
    if (!email) return jsonResponse(400, { error: 'Email is required.' });
    if (!division) return jsonResponse(400, { error: 'Please select your division.' });

    const tempId = last4Digits(phone);
    if (tempId.length !== 4) return jsonResponse(400, { error: 'Please enter a valid phone number.' });

    const rows = await fetchAll(TECHS_LIST);
    const fn = firstName.toLowerCase();
    const ln = lastName.toLowerCase();
    const dup = rows.find(it => it.fields
      && String(it.fields.FirstName || '').trim().toLowerCase() === fn
      && String(it.fields.LastName || '').trim().toLowerCase() === ln
      && String(it.fields.TempID || '') === tempId
    );
    if (dup) return jsonResponse(409, { error: 'You already have an account. Please sign in instead.' });

    const created = await createListItem(TECHS_LIST, {
      Title: firstName + ' ' + lastName,
      FirstName: firstName,
      LastName: lastName,
      Phone: phone,
      Email: email,
      TempID: tempId,
      PayrollID: '',
      Role: 'Employee',
      Division: division,
      Active: true
    });

    return jsonResponse(200, {
      success: true,
      tech: {
        id: created.id,
        firstName, lastName,
        role: 'Employee',
        division,
        tempId
      }
    });
  } catch (e) {
    return jsonResponse(500, { error: e.message });
  }
};
