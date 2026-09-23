/* ============================================================
   get-catalog.js — servicios activos del catalogo, filtrados por
   division. Se usa para "agregar un servicio que encontramos que
   hace falta" en Update Services -- disponible para las divisiones
   que Update Services soporta (Janitorial y Renovations).
============================================================ */

const { readJsonSettings } = require('./lib/package-contents');
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

    const [rows, settings] = await Promise.all([fetchAll(SERVICES_CATALOG_LIST), readJsonSettings(['catalog_service_areas', 'catalog_package_contents'])]);
    const areasMap = settings.catalog_service_areas, pkgMap = settings.catalog_package_contents;
    const catalog = rows
      .filter(it => it.fields)
      .map(it => ({
        sku: it.fields.SKU || '',
        serviceName: it.fields.ServiceName || '',
        division: it.fields.Division || '',
        propertyType: it.fields.PropertyType || '',
        category: it.fields.Category || '',
        /* Sales Description de QuickBooks -> tooltip (gsocd-shared/service-tooltip). */
        description: it.fields.Description || '',
        areas: Array.isArray(areasMap[String(it.fields.SKU || '').trim()]) ? areasMap[String(it.fields.SKU || '').trim()] : [],
        packageItems: Array.isArray(pkgMap[String(it.fields.SKU || '').trim()]) ? pkgMap[String(it.fields.SKU || '').trim()] : [],
        active: it.fields.Active === undefined ? true : (it.fields.Active === true || it.fields.Active === 'true'),
        requiresQuantity: it.fields.RequiresQuantity === true || it.fields.RequiresQuantity === 'true'
      }))
      .filter(s => s.active
        && (!division || s.division.toLowerCase() === division)
        && (!propertyType || s.propertyType.toLowerCase() === propertyType));

    return jsonResponse(200, { catalog });
  } catch (e) {
    return jsonResponse(500, { error: e.message });
  }
};
