/* ============================================================
   lib/translate.js -- ingles -> espanol con Google Translate
   (25/09/2026, pedido del dueño: "hazlo con google a ver que pex").

   Usa la direccion gratis de Google (la misma de translate.google.com,
   sin clave). No es un servicio oficial: si Google la bloquea o falla,
   translateMany devuelve lo que alcanzo y lo demas se queda en ingles
   -- nunca truena la pagina. Por eso lo traducido se guarda (catalogo:
   ServicesCatalog.ServiceNameES) y a Google solo se le pide lo nuevo.

   Si un dia se cambia a la API oficial (Google Cloud Translation, con
   clave), solo se reemplaza googleChunk.
============================================================ */

const ENDPOINT = 'https://translate.googleapis.com/translate_a/single';
const CHUNK_CHARS = 1500;   /* por peticion, para no pasarnos del limite de Google */
const TIMEOUT_MS = 6000;

/* Traduce varias lineas en una sola peticion (unidas con "\n"; Google
   respeta los saltos de linea). Devuelve un arreglo del mismo largo, o
   null si algo no cuadra. */
async function googleChunk(lines) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT + '?client=gtx&sl=en&tl=es&dt=t', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: 'q=' + encodeURIComponent(lines.join('\n')),
      signal: ctrl.signal
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = (Array.isArray(data) && Array.isArray(data[0]) ? data[0] : []).map(p => (p && p[0]) || '').join('');
    const out = text.split('\n').map(s => s.trim());
    return out.length === lines.length ? out : null;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* texts -> { ingles: espanol } con lo que se pudo traducir. */
async function translateMany(texts) {
  const uniq = [...new Set(texts.map(s => String(s || '').trim()).filter(Boolean))];
  const out = {};
  let chunk = [], size = 0;
  const flush = async () => {
    if (!chunk.length) return;
    const lines = chunk; chunk = []; size = 0;
    let res = await googleChunk(lines);
    /* Si el bloque no regreso completo, uno por uno. */
    if (!res && lines.length > 1) {
      res = [];
      for (const l of lines) { const r = await googleChunk([l]); res.push(r ? r[0] : ''); }
    }
    (res || []).forEach((es, i) => { if (es) out[lines[i]] = es; });
  };
  for (const s of uniq) {
    if (size + s.length + 1 > CHUNK_CHARS) await flush();
    chunk.push(s.replace(/\n/g, ' ')); size += s.length + 1;
  }
  await flush();
  return out;
}

module.exports = { translateMany };
