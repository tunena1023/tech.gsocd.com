/* ============================================================
   get-my-history.js — ordenes ya cerradas (Completed/Cancelled) con
   su historial completo. Mismo criterio de alcance que Active Orders:
   Employee ve solo lo suyo, Supervisor ve todo su departamento.
============================================================ */

const {
  ORDERS_LIST, ORDER_HISTORY_LIST, ORDER_ASSIGNMENTS_LIST,
  graphFetch, siteListPath, jsonResponse
} = require('./lib/graph');

const CLOSED_STATUSES = ['Completed', 'Cancelled'];

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
    const techId = String(b.techId || '').trim();
    const role = String(b.role || '').trim();
    const division = String(b.division || '').trim();
    if (!techId || !role) return jsonResponse(400, { error: 'techId and role are required' });

    const [orderRows, histRows, assignRows] = await Promise.all([
      fetchAll(ORDERS_LIST),
      fetchAll(ORDER_HISTORY_LIST),
      role === 'Employee' ? fetchAll(ORDER_ASSIGNMENTS_LIST) : Promise.resolve([])
    ]);

    let closedOrders = orderRows.filter(it => it.fields && CLOSED_STATUSES.includes(it.fields.Status));

    if (role === 'Supervisor') {
      closedOrders = closedOrders.filter(it => String(it.fields.Division || '').toLowerCase() === division.toLowerCase());
    } else {
      const myOrderIds = new Set(
        assignRows.filter(it => it.fields && String(it.fields.TechID || '') === techId)
          .map(it => it.fields.OrderID)
      );
      closedOrders = closedOrders.filter(it => myOrderIds.has(it.fields.OrderID || it.fields.Title));
    }

    const historyByOrder = {};
    histRows.forEach(it => {
      if (!it.fields || !it.fields.OrderID) return;
      (historyByOrder[it.fields.OrderID] = historyByOrder[it.fields.OrderID] || []).push({
        ChangeDate: it.fields.ChangeDate || '',
        ChangeType: it.fields.ChangeType || '',
        ChangedBy: it.fields.ChangedBy || '',
        Notes: it.fields.Notes || ''
      });
    });

    const orders = closedOrders.map(it => {
      const f = it.fields;
      const oid = f.OrderID || f.Title || '';
      const hist = (historyByOrder[oid] || []).sort((a, b) => String(a.ChangeDate).localeCompare(String(b.ChangeDate)));
      return {
        OrderID: oid,
        BusinessName: f.BusinessName || f.Title || '',
        Division: f.Division || '',
        Status: f.Status || '',
        EntryDate: f.EntryDate || '',
        DueDate: f.DueDate || '',
        History: hist
      };
    }).sort((a, b) => String(b.EntryDate).localeCompare(String(a.EntryDate)));

    return jsonResponse(200, { orders });
  } catch (e) {
    return jsonResponse(500, { error: e.message });
  }
};
