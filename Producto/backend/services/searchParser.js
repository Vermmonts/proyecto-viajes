const { GoogleGenerativeAI } = require('@google/generative-ai');

const destinos = [
  'Santiago','Concepción','Antofagasta','Iquique','La Serena','Temuco','Puerto Montt','Punta Arenas','Arica','Calama','Valdivia','Coyhaique',
  'Buenos Aires','Mendoza','Córdoba','Lima','Cusco','Bogotá','Medellín','Cartagena','Rio de Janeiro','Río de Janeiro','São Paulo','Florianópolis',
  'Montevideo','Asunción','Cancún','Ciudad de México','Miami','Nueva York','Los Ángeles','Madrid','Barcelona','París','Roma','Londres','Ámsterdam','Lisboa','Tokio','Dubái'
];

const meses = {
  enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
  julio: '07', agosto: '08', septiembre: '09', setiembre: '09', octubre: '10',
  noviembre: '11', diciembre: '12'
};

function quitarTildes(valor = '') {
  return String(valor).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizarDestino(valor = '') {
  const v = quitarTildes(valor);
  if (v.includes('rio')) return 'Rio de Janeiro';
  if (v.includes('buenos')) return 'Buenos Aires';
  if (v.includes('cancun')) return 'Cancún';
  if (v.includes('bogota')) return 'Bogotá';
  if (v.includes('mexico')) return 'Ciudad de México';
  if (v.includes('punta')) return 'Punta Cana';
  if (v.includes('flor')) return 'Florianópolis';
  const found = destinos.find(d => v.includes(quitarTildes(d)));
  return found || valor;
}

function toDateISO(text) {
  if (!text) return '';
  const m = String(text).match(/(20\d{2})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!m) return '';
  const y = m[1];
  const mo = String(m[2]).padStart(2, '0');
  const d = String(m[3]).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

function parseFechasEspanol(texto = '') {
  const limpio = quitarTildes(texto);

  const fechasISO = limpio.match(/20\d{2}[-/]\d{1,2}[-/]\d{1,2}/g) || [];
  if (fechasISO.length) {
    return { fechaIda: toDateISO(fechasISO[0]), fechaVuelta: toDateISO(fechasISO[1]) };
  }

  let match = limpio.match(/(?:del|de)?\s*(\d{1,2})\s*(?:al|a|hasta)\s*(\d{1,2})\s*de\s*([a-z]+)(?:\s*de)?\s*(20\d{2})/i);
  if (match) {
    const [, d1, d2, mes, year] = match;
    const mm = meses[mes];
    if (mm) {
      return {
        fechaIda: `${year}-${mm}-${String(d1).padStart(2, '0')}`,
        fechaVuelta: `${year}-${mm}-${String(d2).padStart(2, '0')}`
      };
    }
  }

  match = limpio.match(/(\d{1,2})\s*de\s*([a-z]+)\s*(?:al|a|hasta)\s*(\d{1,2})\s*de\s*([a-z]+)(?:\s*de)?\s*(20\d{2})/i);
  if (match) {
    const [, d1, mes1, d2, mes2, year] = match;
    if (meses[mes1] && meses[mes2]) {
      return {
        fechaIda: `${year}-${meses[mes1]}-${String(d1).padStart(2, '0')}`,
        fechaVuelta: `${year}-${meses[mes2]}-${String(d2).padStart(2, '0')}`
      };
    }
  }

  return { fechaIda: '', fechaVuelta: '' };
}

function detectarDestino(texto = '') {
  const lower = quitarTildes(texto);
  return destinos.find(d => lower.includes(quitarTildes(d))) || '';
}

function detectarOrigen(texto = '') {
  const lower = quitarTildes(texto);
  const match = lower.match(/(?:desde|de)\s+([a-z\s]+?)\s+(?:a|hacia|para)\s+/);
  if (!match) return 'Santiago';
  const posible = destinos.find(d => quitarTildes(match[1]).includes(quitarTildes(d)) || quitarTildes(d).includes(quitarTildes(match[1]).trim()));
  return posible || 'Santiago';
}

function parseLocal(query = {}) {
  const texto = String(query.texto || query.q || '').trim();
  const fechasTexto = parseFechasEspanol(texto);
  const destinoFormulario = query.destino || '';
  const origen = query.origen || detectarOrigen(texto) || 'Santiago';
  const fechaIda = query.fechaIda || query.ida || fechasTexto.fechaIda || '';
  const fechaVuelta = query.fechaVuelta || query.vuelta || fechasTexto.fechaVuelta || '';

  let destino = destinoFormulario;
  if (!destino && texto) destino = detectarDestino(texto);

  return {
    origen: origen || 'Santiago',
    destino: normalizarDestino(destino),
    fechaIda,
    fechaVuelta,
    personas: Number(query.personas || 1),
    presupuesto: quitarTildes(texto).includes('barato') ? 'bajo' : (query.presupuesto || '')
  };
}

async function parseWithGemini(input) {
  const apiKey = process.env.GEMINI_API_KEY;
  const local = parseLocal(input);
  if (!apiKey) return local;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' });
    const prompt = `Extrae filtros de busqueda de viajes. Devuelve SOLO JSON valido, sin markdown.
Campos: origen, destino, fechaIda, fechaVuelta, personas, presupuesto.
Si falta origen usa Santiago. Fechas en YYYY-MM-DD.
Entrada: ${JSON.stringify(input)}`;
    const result = await model.generateContent(prompt);
    const raw = result.response.text().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);
    return {
      ...local,
      ...parsed,
      origen: parsed.origen || local.origen,
      destino: normalizarDestino(parsed.destino || local.destino),
      fechaIda: parsed.fechaIda || local.fechaIda,
      fechaVuelta: parsed.fechaVuelta || local.fechaVuelta
    };
  } catch (error) {
    return local;
  }
}

module.exports = { parseWithGemini, parseLocal };
