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
  return String(valor).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function normalizarDestino(valor = '') {
  const v = quitarTildes(valor);
  if (!v) return '';
  if (v.includes('rio de janeiro') || v === 'rio') return 'Rio de Janeiro';
  if (v.includes('buenos')) return 'Buenos Aires';
  if (v.includes('cancun')) return 'Cancún';
  if (v.includes('bogota')) return 'Bogotá';
  if (v.includes('mexico')) return 'Ciudad de México';
  if (v.includes('florianopolis') || v.includes('floripa')) return 'Florianópolis';
  const found = destinos.find(d => v === quitarTildes(d) || v.includes(quitarTildes(d)) || quitarTildes(d).includes(v));
  return found || String(valor).trim();
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

function detectarCiudadEnTexto(fragmento = '') {
  const limpio = quitarTildes(fragmento).replace(/\s+/g, ' ').trim();
  if (!limpio) return '';
  return destinos.find(d => limpio === quitarTildes(d) || limpio.includes(quitarTildes(d)) || quitarTildes(d).includes(limpio)) || '';
}

function detectarRuta(texto = '') {
  const lower = quitarTildes(texto);
  // Casos: "desde Santiago hasta Lima", "de Santiago a Lima", "Santiago hacia Madrid".
  const patrones = [
    /(?:desde|de)\s+([a-záéíóúñ\s]+?)\s+(?:hasta|a|hacia|para)\s+([a-záéíóúñ\s]+?)(?:\s+del|\s+desde|\s+entre|\s+por|\s+en|\s+con|\s+para|\s+el|\s+\d|$)/i,
    /([a-záéíóúñ\s]+?)\s+(?:a|hacia|hasta)\s+([a-záéíóúñ\s]+?)(?:\s+del|\s+desde|\s+entre|\s+por|\s+en|\s+con|\s+para|\s+el|\s+\d|$)/i
  ];

  for (const patron of patrones) {
    const match = lower.match(patron);
    if (match) {
      const origen = detectarCiudadEnTexto(match[1]);
      const destino = detectarCiudadEnTexto(match[2]);
      if (origen || destino) return { origen, destino };
    }
  }

  // Casos: "quiero viajar a Lima", "viaje para Buenos Aires".
  const destinoMatch = lower.match(/(?:viajar|viaje|ir|quiero ir)\s+(?:a|hacia|hasta|para)\s+([a-záéíóúñ\s]+?)(?:\s+del|\s+desde|\s+entre|\s+por|\s+en|\s+con|\s+para|\s+el|\s+\d|$)/i);
  const destino = destinoMatch ? detectarCiudadEnTexto(destinoMatch[1]) : detectarCiudadEnTexto(lower);
  return { origen: '', destino };
}

function detectarDestino(texto = '') {
  return detectarRuta(texto).destino || '';
}

function detectarOrigen(texto = '') {
  return detectarRuta(texto).origen || 'Santiago';
}

function extraerJson(texto = '') {
  const limpio = String(texto).replace(/```json|```/gi, '').trim();
  const inicio = limpio.indexOf('{');
  const fin = limpio.lastIndexOf('}');
  if (inicio === -1 || fin === -1 || fin <= inicio) throw new Error('Gemini no devolvio JSON.');
  return JSON.parse(limpio.slice(inicio, fin + 1));
}

function parseLocal(query = {}) {
  const texto = String(query.texto || query.q || '').trim();
  const fechasTexto = parseFechasEspanol(texto);
  const rutaTexto = detectarRuta(texto);

  // Prioridad correcta: formulario explícito > texto libre interpretado > valor por defecto.
  const origenFormulario = String(query.origen || '').trim();
  const destinoFormulario = String(query.destino || '').trim();
  const origen = origenFormulario || rutaTexto.origen || 'Santiago';
  const destino = destinoFormulario || rutaTexto.destino || '';

  return {
    origen: normalizarDestino(origen) || 'Santiago',
    destino: normalizarDestino(destino),
    fechaIda: query.fechaIda || query.ida || fechasTexto.fechaIda || '',
    fechaVuelta: query.fechaVuelta || query.vuelta || fechasTexto.fechaVuelta || '',
    personas: Number(query.personas || 1),
    presupuesto: quitarTildes(texto).includes('barato') ? 'bajo' : (query.presupuesto || '')
  };
}

function aiEstaConfigurada() {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
}

function resolverFiltrosFinales(input, local, parsed = {}) {
  const origenFormulario = String(input.origen || '').trim();
  const destinoFormulario = String(input.destino || '').trim();

  let origen = origenFormulario || parsed.origen || local.origen || 'Santiago';
  let destino = destinoFormulario || parsed.destino || local.destino || '';

  origen = normalizarDestino(origen) || 'Santiago';
  destino = normalizarDestino(destino);

  // Seguridad: si la IA toma el origen como destino, se corrige usando el texto local.
  if (local.destino && quitarTildes(destino) === quitarTildes(origen) && quitarTildes(local.destino) !== quitarTildes(origen)) {
    destino = local.destino;
  }

  // Si no hay destino explícito en formulario, el parser local manda sobre la IA cuando detectó una ruta "desde ... hasta/a ...".
  if (!destinoFormulario && local.destino && quitarTildes(local.destino) !== quitarTildes(local.origen || '')) {
    destino = local.destino;
  }

  return {
    ...local,
    ...parsed,
    origen,
    destino,
    fechaIda: input.fechaIda || input.ida || parsed.fechaIda || local.fechaIda || '',
    fechaVuelta: input.fechaVuelta || input.vuelta || parsed.fechaVuelta || local.fechaVuelta || '',
    personas: Number(input.personas || parsed.personas || local.personas || 1),
    presupuesto: parsed.presupuesto || local.presupuesto || ''
  };
}

async function parseWithGemini(input) {
  const apiKey = process.env.GEMINI_API_KEY;
  const local = parseLocal(input);
  if (!aiEstaConfigurada()) return { ...local, ia_usada: false, ia_motivo: 'GEMINI_API_KEY no configurada' };

  try {
    const genAI = new GoogleGenerativeAI(apiKey.trim());
    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const model = genAI.getGenerativeModel({ model: modelName });
    const prompt = `Eres un asistente para una app de viajes conectada a MySQL. Extrae filtros de busqueda desde texto libre y formulario.
Devuelve SOLO JSON valido, sin markdown ni explicaciones.
Campos obligatorios:
{
  "origen": "ciudad de origen o Santiago si falta",
  "destino": "ciudad destino o vacio si no aparece",
  "fechaIda": "YYYY-MM-DD o vacio",
  "fechaVuelta": "YYYY-MM-DD o vacio",
  "personas": numero,
  "presupuesto": "bajo, medio, alto o vacio"
}
Reglas importantes:
- En frases como "desde Santiago hasta Lima" o "de Santiago a Lima", la primera ciudad es origen y la segunda ciudad es destino.
- No uses el origen como destino.
- No inventes destino.
- Conserva fechas ISO.
Entrada: ${JSON.stringify(input)}`;
    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const parsed = extraerJson(raw);
    return {
      ...resolverFiltrosFinales(input, local, parsed),
      ia_usada: true,
      ia_modelo: modelName
    };
  } catch (error) {
    console.warn('Gemini no pudo interpretar la busqueda. Se usara parser local:', error.message);
    return { ...local, ia_usada: false, ia_motivo: 'fallback local por error de Gemini' };
  }
}

module.exports = { parseWithGemini, parseLocal, aiEstaConfigurada };
