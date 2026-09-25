/* ============================================================
   get-es-terms.js -- diccionario {ingles: espanol} de lo que viene de
   SharePoint y el tecnico ve en pantalla: nombres de servicios,
   categorias, areas y divisiones del catalogo (25/09/2026, pedido
   del dueño: "todo todo debe estar en espanol").

   i18n.js lo pide solo si el tecnico escogio ESP, y lo guarda en el
   telefono; las pantallas se siguen pintando en ingles y i18n.js
   cambia cada texto que este en el diccionario.

   Nombres de servicios: columna ServicesCatalog.ServiceNameES. Si esta
   vacia se traduce con Google (lib/translate.js) y se guarda ahi, asi
   cada servicio nuevo se traduce UNA vez y la oficina puede corregir
   la traduccion en esa columna. Si la columna no existe, igual se
   traduce, nomas no se guarda.
   Categorias, areas y divisiones: se traducen y se quedan en memoria
   del servidor (son pocas).
============================================================ */
const { SERVICES_CATALOG_LIST, graphFetch, siteListPath, updateListItemByItemId, jsonResponse } = require('./lib/graph');
const catalogFields = require('./lib/catalog-fields');
const { translateMany } = require('./lib/translate');

const MAX_NEW_PER_CALL = 200;   /* lo que se manda a Google por peticion; lo demas, a la siguiente */
const memo = {};                /* categorias / areas / divisiones ya traducidas */
let columnMissing = false;

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

const clean = s => String(s || '').trim();

exports.handler = async () => {
  try {
    const rows = (await fetchAll(SERVICES_CATALOG_LIST)).filter(it => it.fields && clean(it.fields.ServiceName));
    const terms = {};
    const pendingRows = [];
    const extra = new Set();

    rows.forEach(it => {
      const f = it.fields;
      const name = clean(f.ServiceName);
      const es = clean(f.ServiceNameES);
      if (es) terms[name] = es;
      else pendingRows.push(it);
      [f.Category, f.Division].map(clean).filter(Boolean).forEach(x => extra.add(x));
      catalogFields.areasOf(f).forEach(a => {
        const n = clean(typeof a === 'string' ? a : (a && (a.name || a.label || a.area)));
        if (n) extra.add(n);
      });
    });

    /* Mismo nombre en dos renglones: basta con una traduccion guardada. */
    const todo = pendingRows.filter(it => !terms[clean(it.fields.ServiceName)]).slice(0, MAX_NEW_PER_CALL);
    const extraTodo = [...extra].filter(x => !memo[x]);
    const fresh = await translateMany(todo.map(it => clean(it.fields.ServiceName)).concat(extraTodo));

    extraTodo.forEach(x => { if (fresh[x]) memo[x] = fresh[x]; });
    Object.assign(terms, memo);

    const toSave = [];
    todo.forEach(it => {
      const name = clean(it.fields.ServiceName);
      if (!fresh[name]) return;
      terms[name] = fresh[name];
      toSave.push(it);
    });

    /* Se guarda en SharePoint de 5 en 5; si falla (columna que no
       existe), se deja de intentar hasta que el servidor reinicie. */
    for (let i = 0; i < toSave.length && !columnMissing; i += 5) {
      await Promise.all(toSave.slice(i, i + 5).map(it =>
        updateListItemByItemId(SERVICES_CATALOG_LIST, it.id, { ServiceNameES: terms[clean(it.fields.ServiceName)] })
          .catch(e => { columnMissing = true; console.error('get-es-terms save:', e.message); })));
    }

    /* Todos los renglones con el mismo nombre (otra division/tipo). */
    pendingRows.forEach(it => {
      const name = clean(it.fields.ServiceName);
      if (!terms[name] && fresh[name]) terms[name] = fresh[name];
    });

    const missing = pendingRows.filter(it => !terms[clean(it.fields.ServiceName)]).length;
    return jsonResponse(200, { terms, missing });
  } catch (e) {
    return jsonResponse(500, { error: e.message });
  }
};
