/* ============================================================
   app-version.js — que version de la app esta publicada (26/09/2026).
   La usa gsocd-shared/app-update: si cambia, la pagina abierta en el
   telefono se pone al dia sola. Es el commit de este deploy en Vercel
   (cambia en cada deploy, sin pasos extra). Publica: no trae datos.
============================================================ */
exports.handler = async () => ({
  statusCode: 200,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify({
    version: process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_URL || ''
  })
});
