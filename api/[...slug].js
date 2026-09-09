/* api/[...slug].js — un solo endpoint que reparte el trafico a todas
   las funciones de la raiz, igual que en admin/orders. */
const { toVercel } = require('../lib/vercel-adapter');

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
  'site-image': require('../site-image').handler
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
  return toVercel(h)(req, res);
};
