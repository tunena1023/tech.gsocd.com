/* ============================================================
   get-catalog.js — servicios activos del catalogo, filtrados por
   division. Solo se usa para "agregar un servicio que encontramos
   que hace falta" en Update Services (Renovations principalmente).
============================================================ */

const { SERVICES_CATALOG_LIST, graphFetch, siteListPath, jsonResponse } = require('./lib/graph');

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
    const division = String(b.division || '').trim().toLowerCase();
    const propertyType = String(b.propertyType || '').trim().toLowerCase();

    const rows = await fetchAll(SERVICES_CATALOG_LIST);
    const catalog = rows
      .filter(it => it.fields)
      .map(it => ({
        sku: it.fields.SKU || '',
        serviceName: it.fields.ServiceName || '',
        division: it.fields.Division || '',
        propertyType: it.fields.PropertyType || '',
        active: it.fields.Active === undefined ? true : (it.fields.Active === true || it.fields.Active === 'true')
      }))
      .filter(s => s.active
        && (!division || s.division.toLowerCase() === division)
        && (!propertyType || s.propertyType.toLowerCase() === propertyType));

    return jsonResponse(200, { catalog });
  } catch (e) {
    return jsonResponse(500, { error: e.message });
  }
};
