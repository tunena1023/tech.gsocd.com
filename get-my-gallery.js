/* ============================================================
   get-my-gallery.js — fotos agrupadas por orden.

   No hay ninguna lista de SharePoint que registre las fotos por
   separado -- todo se deduce leyendo la carpeta directo:
   TechPhotos/<ClientID> - <BusinessName>/<OrderID>/Photos/*.jpg
   (mismo criterio ya confirmado: no importa quien tomo cada foto).

   Employee: solo las ordenes que tiene/tuvo asignadas (OrderAssignments).
   Supervisor: todas las de su departamento (Division), sin importar
   si siguen activas o ya se cerraron -- la galeria no es solo de lo
   activo, es historico.
============================================================ */

const {
  ORDERS_LIST, ORDER_ASSIGNMENTS_LIST,
  listChildren, graphFetch, siteListPath, jsonResponse
} = require('./lib/graph');

const PHOTOS_FOLDER = process.env.GRAPH_PHOTOS_FOLDER || 'TechPhotos';

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

function clientFolderName(f) {
  return (String(f.ClientID || '').trim() + ' - ' + String(f.BusinessName || '').trim())
    .replace(/[\\/:*?"<>|]/g, '').trim();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  try {
    const b = JSON.parse(event.body || '{}');
    const techId = String(b.techId || '').trim();
    const role = String(b.role || '').trim();
    const division = String(b.division || '').trim();
    if (!techId || !role) return jsonResponse(400, { error: 'techId and role are required' });

    const [orderRows, assignRows] = await Promise.all([
      fetchAll(ORDERS_LIST),
      role === 'Employee' ? fetchAll(ORDER_ASSIGNMENTS_LIST) : Promise.resolve([])
    ]);

    let myOrders = orderRows.filter(it => it.fields);
    if (role === 'Supervisor') {
      myOrders = myOrders.filter(it => String(it.fields.Division || '').toLowerCase() === division.toLowerCase());
    } else {
      const myOrderIds = new Set(
        assignRows.filter(it => it.fields && String(it.fields.TechID || '') === techId)
          .map(it => it.fields.OrderID)
      );
      myOrders = myOrders.filter(it => myOrderIds.has(it.fields.OrderID || it.fields.Title));
    }

    const groups = await Promise.all(myOrders.map(async (it) => {
      const f = it.fields;
      const orderId = f.OrderID || f.Title || '';
      const folderPath = PHOTOS_FOLDER + '/' + clientFolderName(f) + '/' + orderId + '/Photos';
      const kids = await listChildren(folderPath);
      const photos = kids.filter(k => k.isFile).sort((a, b) => a.name.localeCompare(b.name));
      if (!photos.length) return null;
      return {
        orderId,
        clientLabel: f.BusinessName || f.ClientID || '',
        division: f.Division || '',
        date: f.EntryDate || f.DispatchDate || '',
        photos: photos.map(p => ({ name: p.name, downloadUrl: p.downloadUrl }))
      };
    }));

    const nonEmpty = groups.filter(Boolean).sort((a, b) => String(b.date).localeCompare(String(a.date)));

    return jsonResponse(200, { groups: nonEmpty });
  } catch (e) {
    return jsonResponse(500, { error: e.message });
  }
};
