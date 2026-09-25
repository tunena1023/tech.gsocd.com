/* ============================================================
   lib/tech-auth.js -- sesion del tecnico en el SERVIDOR (25/09/2026).

   Antes: cada funcion le creia al navegador el techId, el role, la
   division y el nombre (actor) que mandara. Cualquiera en internet podia
   pedir /api/get-my-orders con el techId de otro, o mandar un
   "Supervisor Update" a nombre de un supervisor.

   Ahora el tecnico entra igual que siempre (QR de la oficina -> device
   token, o nombre + ultimos 4 del telefono) y el servidor le manda una
   cookie FIRMADA (HttpOnly) con quien es: techId, rol, nombre y division,
   leidos de la lista Techs, nunca del navegador. Dura 30 dias y se
   renueva cada vez que se abre la app (device-auth verify-device).
   El router (api/[...slug].js) escribe esos datos encima del body en
   cada peticion.

   Variable obligatoria: TECH_SESSION_SECRET (distinta en Production y
   Preview). Sin ella nadie entra (falla cerrado).
============================================================ */
const crypto = require('crypto');

const COOKIE = 'gs_tech_auth';
const TTL_SECONDS = 30 * 24 * 3600;

function secret() {
  const s = String(process.env.TECH_SESSION_SECRET || '');
  if (s.length < 32) throw new Error('Sign-in is not configured (TECH_SESSION_SECRET).');
  return s;
}
function b64url(buf) { return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); }
function hmac(data) { return b64url(crypto.createHmac('sha256', secret()).update(data).digest()); }

function signToken(payload) {
  const body = b64url(JSON.stringify(payload));
  return body + '.' + hmac(body);
}

function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return null;
  let expected;
  try { expected = hmac(parts[0]); } catch (e) { return null; }
  const a = Buffer.from(parts[1]); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let p;
  try { p = JSON.parse(Buffer.from(parts[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); } catch (e) { return null; }
  if (!p || !p.tid || !p.exp || p.exp * 1000 < Date.now()) return null;
  return p;
}

function readSession(headers) {
  const h = headers || {};
  const key = Object.keys(h).find(k => k.toLowerCase() === 'cookie');
  const raw = key ? String(h[key]) : '';
  const part = raw.split(';').map(s => s.trim()).find(s => s.indexOf(COOKIE + '=') === 0);
  if (!part) return null;
  return verifyToken(decodeURIComponent(part.slice(COOKIE.length + 1)));
}

/* techRow = item de la lista Techs ({ id, fields }) */
function sessionCookie(techRow) {
  const f = techRow.fields || {};
  const token = signToken({
    tid: String(techRow.id),
    role: f.Role || 'Employee',
    name: ((f.FirstName || '') + ' ' + (f.LastName || '')).trim(),
    division: f.Division || '',
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS
  });
  return COOKIE + '=' + encodeURIComponent(token) + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + TTL_SECONDS;
}

function clearCookie() {
  return COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

/* Lo que guarda el navegador de la sesion (GS.session). Mismo formato en
   device-auth, login-tech y tech-session. */
function techSessionShape(techRow) {
  const f = techRow.fields || {};
  return {
    id: techRow.id,
    firstName: f.FirstName || '',
    lastName: f.LastName || '',
    role: f.Role || 'Employee',
    division: f.Division || '',
    tempId: f.TempID || '',
    language: f.Language || ''
  };
}

/* Agrega Set-Cookie a una respuesta de jsonResponse. */
function withCookie(res, cookie) {
  res.headers = Object.assign({}, res.headers, { 'Set-Cookie': cookie });
  return res;
}

module.exports = { COOKIE, signToken, verifyToken, readSession, sessionCookie, clearCookie, withCookie, techSessionShape };
