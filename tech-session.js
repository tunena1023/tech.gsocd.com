/* ============================================================
   tech-session.js -- la app se "acuerda" del tecnico (25/09/2026).

   Pedido del dueño: los tecnicos entran desde un acceso directo en el
   celular y ahi "los bloquea". La sesion del navegador
   (sessionStorage) se borra cada vez que se abre el acceso directo, y
   quien entro con nombre + 4 digitos (sin QR) no tenia nada mas: le
   volvia a salir el login, aunque su cookie firmada seguia valida 30
   dias. Ahora index.html pregunta aqui primero:

     action 'restore' -> con la cookie valida (el router ya la reviso y
                         puso techId en el body), regresa sus datos
                         frescos de Techs y renueva la cookie 30 dias.
     action 'logout'  -> borra la cookie (boton Sign out).

   Si la cuenta se desactivo en Admin, 'restore' contesta 403 y borra
   la cookie: no puede seguir entrando.
============================================================ */
const { TECHS_LIST, graphFetch, siteListPath, jsonResponse } = require('./lib/graph');
const { sessionCookie, clearCookie, withCookie, techSessionShape } = require('./lib/tech-auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  try {
    const b = JSON.parse(event.body || '{}');
    if (b.action === 'logout') return withCookie(jsonResponse(200, { success: true }), clearCookie());

    const techId = String(b.techId || '').trim();
    if (!techId) return jsonResponse(401, { error: 'Please sign in again.', signin: true });
    let row = null;
    try {
      row = await graphFetch(siteListPath(TECHS_LIST) + '/' + encodeURIComponent(techId) + '?$expand=fields');
    } catch (e) {
      if (/404|not ?found/i.test(e.message)) row = null; else throw e;
    }
    if (!row || !row.fields) return withCookie(jsonResponse(401, { error: 'Please sign in again.', signin: true }), clearCookie());
    if (row.fields.Role === 'Contractor') return withCookie(jsonResponse(403, { error: "Contractors don't have access to the tech app. Please contact the office." }), clearCookie());
    if (row.fields.Active === false || row.fields.Active === 'false') {
      return withCookie(jsonResponse(403, { error: 'This account is inactive. Please contact the office.' }), clearCookie());
    }
    return withCookie(jsonResponse(200, { tech: techSessionShape(row) }), sessionCookie(row));
  } catch (e) {
    return jsonResponse(500, { error: e.message });
  }
};
