/* api/[...slug].js — un solo endpoint que reparte el trafico a todas
   las funciones de la raiz, igual que en admin/orders. */
const { toVercel } = require('../lib/vercel-adapter');
/* 25/09/2026: sesion firmada del tecnico (lib/tech-auth.js). Sin ella,
   401. Quien es (techId, rol, nombre, division) sale de la cookie y se
   escribe encima del body: el navegador ya no lo puede cambiar. */
const { readSession } = require('../lib/tech-auth');
const PUBLIC = new Set(['register-tech', 'login-tech', 'device-auth', 'site-image', 'get-catalog']);

const handlers = {
  'register-tech': require('../register-tech').handler,
  'login-tech': require('../login-tech').handler,
  'device-auth': require('../device-auth').handler,
  'get-my-orders': require('../get-my-orders').handler,
  'get-my-history': require('../get-my-history').handler,
  'get-my-gallery': require('../get-my-gallery').handler,
  'get-catalog': require('../get-catalog').handler,
  'upload-photo': require('../upload-photo').handler,
  'submit-supervisor-update': require('../submit-supervisor-update').handler,
  'submit-employee-complete': require('../submit-employee-complete').handler,
  'report-unit-not-ready': require('../report-unit-not-ready').handler,
  'save-push-subscription': require('../save-push-subscription').handler,
  'site-image': require('../site-image').handler,
  'submit-recurring-complete': require('../submit-recurring-complete').handler,
  'submit-recurring-update': require('../submit-recurring-update').handler,
  'upload-recurring-photo': require('../upload-recurring-photo').handler,
  'upload-service-photo': require('../upload-service-photo').handler,
  'get-recurring-history': require('../get-recurring-history').handler,
  'submit-service-complete': require('../submit-service-complete').handler,
  'submit-extra-request': require('../submit-extra-request').handler
};

module.exports = async (req, res) => {
  const pathOnly = (req.url || '').split('?')[0];
  const parts = pathOnly.split('/').filter(Boolean); // ['api', 'login-tech']
  const slug = parts[parts.length - 1];
  const h = handlers[slug];
  if (!h) {
    res.status(404).json({ error: 'Unknown endpoint: ' + slug });
    return;
  }
  if (!PUBLIC.has(slug)) {
    const s = readSession(req.headers);
    if (!s) { res.status(401).json({ error: 'Please sign in again.', signin: true }); return; }
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body || '{}'); } catch (e) { body = {}; } }
    if (!body || typeof body !== 'object') body = {};
    body.techId = s.tid;
    body.role = s.role;
    body.division = s.division;
    body.actor = s.name;
    req.body = body;
  }
  return toVercel(h)(req, res);
};
