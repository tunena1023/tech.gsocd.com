/* ============================================================
   order-docs.js -- documentos de una orden en el portal de tecnicos
   (25/09/2026). Tecnicos SOLO ven (decision del dueño): aqui solo
   existe action 'view' { orderId, docId } -> { viewUrl, downloadUrl },
   y solo para ordenes que el tecnico puede ver (mismo criterio que su
   galeria, get-my-gallery.scopedOrders). Quien es sale de la cookie.
============================================================ */
const graph = require('./lib/graph');
const orderDocs = require('./lib/order-docs');
const { scopedOrders } = require('./get-my-gallery');
const { jsonResponse } = graph;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  try {
    const b = JSON.parse(event.body || '{}');
    if (b.action !== 'view') return jsonResponse(403, { error: 'Technicians can only view documents.' });
    const orderId = String(b.orderId || '').trim();
    const mine = await scopedOrders(String(b.techId || ''), String(b.role || ''), String(b.division || ''));
    if (!mine.some(it => (it.fields.OrderID || it.fields.Title) === orderId)) return jsonResponse(404, { error: 'Document not found.' });
    const row = await orderDocs.getRow(graph, String(b.docId || ''));
    if (!row || (row.fields || {}).OrderID !== orderId) return jsonResponse(404, { error: 'Document not found.' });
    return jsonResponse(200, await orderDocs.viewUrls(graph, row));
  } catch (e) {
    return jsonResponse(e.status || 500, { error: e.message });
  }
};
