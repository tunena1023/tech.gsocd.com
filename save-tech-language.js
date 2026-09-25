/* save-tech-language.js -- ENG/ESP que escogio el tecnico (25/09/2026).
   Se guarda en Techs.Language para que sea su idioma por defecto en
   cualquier telefono. Quien es sale de la cookie (api/[...slug].js).
   Si la columna todavia no existe, no truena: el idioma queda solo en
   ese telefono. */
const { TECHS_LIST, updateListItemByItemId, jsonResponse } = require('./lib/graph');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  try {
    const b = JSON.parse(event.body || '{}');
    const language = b.language === 'es' ? 'es' : 'en';
    if (!b.techId) return jsonResponse(400, { error: 'techId is required' });
    try {
      await updateListItemByItemId(TECHS_LIST, String(b.techId), { Language: language });
    } catch (e) {
      console.error('save-tech-language:', e.message);
      return jsonResponse(200, { success: false, language, saved: false });
    }
    return jsonResponse(200, { success: true, language, saved: true });
  } catch (e) {
    return jsonResponse(500, { error: e.message });
  }
};
