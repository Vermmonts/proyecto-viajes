const destinos = [
  'Santiago','Concepción','Antofagasta','Iquique','La Serena','Temuco','Puerto Montt','Punta Arenas','Arica','Calama','Valdivia','Coyhaique',
  'Buenos Aires','Mendoza','Córdoba','Lima','Cusco','Bogotá','Medellín','Cartagena','Rio de Janeiro','Río de Janeiro','São Paulo','Florianópolis',
  'Montevideo','Asunción','Cancún','Ciudad de México','Miami','Nueva York','Los Ángeles','Madrid','Barcelona','París','Roma','Londres','Ámsterdam','Lisboa','Tokio','Dubái'
];

function quitarTildes(valor = '') {
  return String(valor).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function detectarCiudad(texto = '') {
  const limpio = quitarTildes(texto);
  return destinos.find((d) => limpio.includes(quitarTildes(d))) || '';
}

function detectarRuta(texto = '') {
  const limpio = String(texto);
  const patrones = [
    /(?:desde|de)\s+([a-záéíóúñ\s]+?)\s+(?:hasta|a|hacia|para)\s+([a-záéíóúñ\s]+?)(?:\s+por|\s+con|\s+en|\s+durante|\s+el|\s+la|\s+\d|$)/i,
    /(?:viajar|viaje|ir)\s+(?:a|hacia|hasta|para)\s+([a-záéíóúñ\s]+?)(?:\s+por|\s+con|\s+en|\s+durante|\s+el|\s+la|\s+\d|$)/i
  ];
  const ruta = limpio.match(patrones[0]);
  if (ruta) return { origen: detectarCiudad(ruta[1]) || ruta[1].trim(), destino: detectarCiudad(ruta[2]) || ruta[2].trim() };
  const destino = limpio.match(patrones[1]);
  return { origen: '', destino: destino ? (detectarCiudad(destino[1]) || destino[1].trim()) : '' };
}

function extraerMonto(texto = '') {
  const match = String(texto).match(/(?:\$|presupuesto(?:\s+de)?|tengo|hasta)\s*([0-9][0-9.,\s]*)\s*(mil|millones?)?/i);
  if (!match) return null;
  let valor = Number(String(match[1]).replace(/[.,\s]/g, ''));
  if (/mil/i.test(match[2] || '')) valor *= 1000;
  if (/millon/i.test(match[2] || '')) valor *= 1000000;
  return Number.isFinite(valor) && valor > 0 ? valor : null;
}

function extraerNoches(texto = '') {
  const match = String(texto).match(/(\d+)\s*(?:noches?|d[ií]as?)/i);
  return match ? Math.max(1, Number(match[1])) : 3;
}

function parseLocal(query = {}) {
  const texto = String(query.texto || query.q || '').trim();
  const ruta = detectarRuta(texto);
  return {
    origen: String(query.origen || '').trim() || ruta.origen || 'Santiago de Chile',
    destino: String(query.destino || '').trim() || ruta.destino || '',
    fechaIda: query.fechaIda || query.ida || '',
    fechaVuelta: query.fechaVuelta || query.vuelta || '',
    personas: Math.max(1, Number(query.personas || 1)),
    presupuesto_total: extraerMonto(texto) || Number(query.presupuesto_total || 0) || null,
    cantidad_noches: extraerNoches(texto),
    intencion: 'generar_viaje',
    buscar_web: true,
    moneda: 'CLP',
    flexibilidad_fechas: !query.fechaIda,
    tipo_viaje: /familia|niñ|hijos/i.test(texto) ? 'familiar'
      : /pareja|rom[aá]ntic|luna de miel/i.test(texto) ? 'pareja'
      : /trabajo|negocios/i.test(texto) ? 'negocios'
      : /aventura|trekking|naturaleza/i.test(texto) ? 'aventura'
      : /descanso|relajo|playa/i.test(texto) ? 'descanso' : 'general',
    prioridades: /barato|econ[oó]mico|ahorrar|presupuesto/i.test(texto) ? ['precio'] : [],
    preferencias: [],
    restricciones: [],
    supuestos_inferidos: []
  };
}

function aiEstaConfigurada() {
  return Boolean(
    process.env.TAVILY_API_KEY && process.env.TAVILY_API_KEY.trim() &&
    process.env.OLLAMA_URL && process.env.OLLAMA_MODEL
  );
}

async function parseWithAI(input = {}) {
  const local = parseLocal(input);
  return {
    ...local,
    ia_usada: aiEstaConfigurada(),
    ia_modelo: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
    ia_motivo: aiEstaConfigurada()
      ? 'Ollama completará la interpretación y Tavily realizará la búsqueda web.'
      : 'Falta configurar Ollama o TAVILY_API_KEY.'
  };
}

const parseWithGemini = parseWithAI;
module.exports = { parseWithAI, parseWithGemini, parseLocal, aiEstaConfigurada };
