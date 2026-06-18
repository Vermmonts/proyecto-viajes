const http = require('http');
const https = require('https');
const pool = require('../db');

function webEstaConfigurada() {
  return Boolean(
    process.env.TAVILY_API_KEY && process.env.TAVILY_API_KEY.trim() &&
    process.env.OLLAMA_URL && process.env.OLLAMA_URL.trim() &&
    process.env.OLLAMA_MODEL && process.env.OLLAMA_MODEL.trim()
  );
}

function limpiarUrl(url = '') {
  try { return new URL(url).toString(); } catch (_) { return ''; }
}

function dominioDe(url = '') {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch (_) { return ''; }
}

function extraerJson(texto = '') {
  const limpio = String(texto)
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json|```/gi, '')
    .trim();
  const inicio = limpio.indexOf('{');
  const fin = limpio.lastIndexOf('}');
  if (inicio < 0 || fin <= inicio) return null;
  try { return JSON.parse(limpio.slice(inicio, fin + 1)); } catch (_) { return null; }
}

function valorBooleano(valor, defecto = false) {
  if (valor === undefined || valor === null || valor === '') return defecto;
  return ['1', 'true', 'si', 'sí', 'yes', 'on'].includes(String(valor).toLowerCase());
}

/**
 * Solicitud JSON usando los módulos HTTP nativos de Node.
 * Evita el HeadersTimeoutError interno de fetch/Undici en procesos locales largos.
 */
function solicitarJson(urlString, {
  method = 'POST',
  headers = {},
  body = null,
  timeoutMs = 60000,
  etiqueta = 'El servicio',
  maxBytes = 20 * 1024 * 1024
} = {}) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(urlString);
    } catch (_) {
      reject(new Error(`URL inválida para ${etiqueta}.`));
      return;
    }

    const transport = url.protocol === 'https:' ? https : http;
    const contenido = body === null ? null : JSON.stringify(body);
    const requestHeaders = { ...headers };

    if (contenido !== null) {
      requestHeaders['Content-Type'] = requestHeaders['Content-Type'] || 'application/json';
      requestHeaders['Content-Length'] = Buffer.byteLength(contenido);
    }

    const req = transport.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method,
      headers: requestHeaders,
      agent: false
    }, (res) => {
      const partes = [];
      let total = 0;

      res.on('data', (chunk) => {
        total += chunk.length;
        if (total > maxBytes) {
          req.destroy(new Error(`${etiqueta} devolvió una respuesta demasiado grande.`));
          return;
        }
        partes.push(chunk);
      });

      res.on('end', () => {
        const texto = Buffer.concat(partes).toString('utf8');
        let payload = {};

        if (texto.trim()) {
          try {
            payload = JSON.parse(texto);
          } catch (_) {
            payload = { raw: texto };
          }
        }

        resolve({
          ok: Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 300),
          status: res.statusCode || 0,
          headers: res.headers,
          payload,
          texto
        });
      });
    });

    req.setTimeout(timeoutMs, () => {
      const error = new Error(`${etiqueta} superó el tiempo máximo de ${Math.ceil(timeoutMs / 1000)} segundos.`);
      error.code = 'REQUEST_TIMEOUT';
      req.destroy(error);
    });

    req.on('error', (error) => reject(error));

    if (contenido !== null) req.write(contenido);
    req.end();
  });
}

async function llamarOllama(messages, options = {}) {
  const baseUrl = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
  const model = process.env.OLLAMA_MODEL || 'qwen3:4b';
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 900000);
  const numCtx = Number(process.env.OLLAMA_NUM_CTX || 4096);
  const numPredict = Number(options.numPredict || process.env.OLLAMA_NUM_PREDICT || 1800);

  let response;
  try {
    response = await solicitarJson(`${baseUrl}/api/chat`, {
      timeoutMs,
      etiqueta: 'Ollama',
      body: {
        model,
        messages,
        stream: false,
        format: 'json',
        think: valorBooleano(process.env.OLLAMA_THINK, false),
        keep_alive: process.env.OLLAMA_KEEP_ALIVE || '15m',
        options: {
          temperature: options.temperature ?? 0.15,
          num_ctx: numCtx,
          num_predict: numPredict
        }
      }
    });
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error('No fue posible conectar con Ollama. Inicia Ollama y vuelve a intentar.');
    }
    if (error.code === 'REQUEST_TIMEOUT') {
      throw new Error(`Ollama no terminó dentro de ${Math.ceil(timeoutMs / 60000)} minutos. Reduce el modelo o la cantidad de resultados.`);
    }
    throw new Error(`Error de conexión con Ollama: ${error.message}`);
  }

  if (!response.ok) {
    throw new Error(response.payload?.error || `Ollama respondió HTTP ${response.status}`);
  }

  const texto = response.payload?.message?.content || '';
  const json = extraerJson(texto);
  if (!json) throw new Error('Ollama respondió, pero no entregó JSON válido.');

  return { json, texto, model };
}

function interpretacionFallback(textoOriginal = '', filtrosLocales = {}) {
  const noches = Number(
    filtrosLocales.cantidad_noches ||
    filtrosLocales.noches ||
    3
  );
  const personas = Math.max(1, Number(filtrosLocales.personas || filtrosLocales.adultos || 1));
  const destino = String(filtrosLocales.destino || '').trim();

  return {
    origen: String(filtrosLocales.origen || 'Santiago de Chile').trim(),
    destino,
    destino_abierto: !destino,
    fecha_ida: filtrosLocales.fechaIda || filtrosLocales.fecha_ida || '',
    fecha_vuelta: filtrosLocales.fechaVuelta || filtrosLocales.fecha_vuelta || '',
    fechas_flexibles: !(filtrosLocales.fechaIda || filtrosLocales.fecha_ida),
    cantidad_noches: Number.isFinite(noches) && noches > 0 ? noches : 3,
    adultos: personas,
    ninos: Math.max(0, Number(filtrosLocales.ninos || 0)),
    presupuesto_total: Number(filtrosLocales.presupuesto_total || 0) || null,
    moneda: filtrosLocales.moneda || 'CLP',
    tipo_viaje: filtrosLocales.tipo_viaje || 'general',
    prioridades: filtrosLocales.prioridades || [],
    preferencias: filtrosLocales.preferencias || [],
    restricciones: filtrosLocales.restricciones || [],
    equipaje: 'no indicado',
    clase_vuelo: 'economica',
    max_escalas: null,
    tipo_alojamiento: 'hotel',
    supuestos: [
      ...(!filtrosLocales.origen ? ['Se consideró Santiago de Chile como punto de partida.'] : []),
      ...(!destino ? ['Se consideró un destino flexible.'] : []),
      ...(!filtrosLocales.cantidad_noches ? ['Se consideraron 3 noches.'] : [])
    ],
    consulta_original: textoOriginal
  };
}

async function interpretarSolicitudConOllama(textoOriginal = '', filtrosLocales = {}) {
  const prompt = `Analiza la solicitud de viaje y devuelve SOLO JSON válido. Sé directo y no incluyas explicaciones fuera del JSON.

Solicitud del usuario:
${textoOriginal || 'Buscar la mejor opción de viaje'}

Datos detectados localmente:
${JSON.stringify(filtrosLocales)}

Extrae o infiere:
{
  "origen": "",
  "destino": "",
  "destino_abierto": false,
  "fecha_ida": "",
  "fecha_vuelta": "",
  "fechas_flexibles": true,
  "cantidad_noches": 3,
  "adultos": 1,
  "ninos": 0,
  "presupuesto_total": null,
  "moneda": "CLP",
  "tipo_viaje": "general",
  "prioridades": [],
  "preferencias": [],
  "restricciones": [],
  "equipaje": "no indicado",
  "clase_vuelo": "economica",
  "max_escalas": null,
  "tipo_alojamiento": "hotel",
  "supuestos": []
}

Reglas:
- Si no se indica origen, usa Santiago de Chile y anótalo en supuestos.
- Si no se indica destino, marca destino_abierto=true.
- Si no hay fechas, considera fechas flexibles.
- Si no se indica duración, usa 3 noches y anótalo en supuestos.
- Si no se indican pasajeros, usa 1 adulto y anótalo en supuestos.
- Interpreta expresiones vagas como barato, playa, descanso, fin de semana, familiar o romántico.
- No inventes disponibilidad, tarifas ni enlaces.`;

  const { json } = await llamarOllama(
    [{ role: 'user', content: prompt }],
    { temperature: 0.05, numPredict: 700 }
  );
  return json;
}

function construirConsultaTavily(interpretacion, textoOriginal) {
  const viajeros = Math.max(1, Number(interpretacion.adultos || 1) + Number(interpretacion.ninos || 0));
  const destino = interpretacion.destino_abierto || !interpretacion.destino
    ? 'destinos convenientes desde Chile'
    : interpretacion.destino;
  const fechas = interpretacion.fecha_ida
    ? `${interpretacion.fecha_ida}${interpretacion.fecha_vuelta ? ` a ${interpretacion.fecha_vuelta}` : ''}`
    : 'fechas flexibles y tarifas actuales';
  const presupuesto = interpretacion.presupuesto_total
    ? `presupuesto total ${interpretacion.presupuesto_total} ${interpretacion.moneda || 'CLP'}`
    : 'mejor relación precio calidad';

  return [
    `mejor opción de viaje desde ${interpretacion.origen || 'Santiago de Chile'} a ${destino}`,
    `${fechas}, ${interpretacion.cantidad_noches || 3} noches, ${viajeros} pasajero(s), ${presupuesto}`,
    'comparar vuelos actuales, alojamiento, aeropuerto más conveniente, traslado al destino final y enlaces de reserva',
    `solicitud original: ${textoOriginal}`
  ].join('. ');
}

async function buscarConTavily(query) {
  const timeoutMs = Number(process.env.TAVILY_TIMEOUT_MS || 90000);
  const maxResults = Math.min(8, Math.max(3, Number(process.env.TAVILY_MAX_RESULTS || 6)));

  let response;
  try {
    response = await solicitarJson('https://api.tavily.com/search', {
      timeoutMs,
      etiqueta: 'El servicio de búsqueda',
      headers: {
        Authorization: `Bearer ${process.env.TAVILY_API_KEY.trim()}`
      },
      body: {
        query,
        topic: 'general',
        search_depth: process.env.TAVILY_SEARCH_DEPTH || 'basic',
        include_answer: true,
        include_raw_content: false,
        max_results: maxResults
      }
    });
  } catch (error) {
    if (error.code === 'REQUEST_TIMEOUT') {
      throw new Error('El servicio de búsqueda demoró demasiado en responder. Intenta nuevamente.');
    }
    throw new Error(`No fue posible consultar internet: ${error.message}`);
  }

  if (!response.ok) {
    throw new Error(
      response.payload?.detail ||
      response.payload?.message ||
      `El servicio de búsqueda respondió HTTP ${response.status}`
    );
  }

  const payload = response.payload || {};
  const results = Array.isArray(payload.results) ? payload.results : [];
  return {
    answer: payload.answer || '',
    query: payload.query || query,
    response_time: payload.response_time || null,
    results: results.map((r) => ({
      title: r.title || dominioDe(r.url),
      url: limpiarUrl(r.url),
      content: String(r.content || '').slice(0, 1100),
      score: Number(r.score || 0),
      published_date: r.published_date || null
    })).filter((r) => r.url)
  };
}

function crearAnalisisFallback(interpretacion, webData) {
  const ordenados = [...webData.results].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  const principal = ordenados[0] || {};
  const destino = interpretacion.destino || 'Destino por confirmar';
  const personas = Math.max(1, Number(interpretacion.adultos || 1) + Number(interpretacion.ninos || 0));

  const convertirAlternativa = (r, indice) => ({
    titulo: `Alternativa ${indice + 1}`,
    origen: interpretacion.origen || 'Santiago de Chile',
    destino_final: destino,
    aeropuerto_llegada: 'Por confirmar con el proveedor',
    fechas: interpretacion.fecha_ida || 'Fechas flexibles',
    personas,
    vuelo: {
      proveedor: dominioDe(r.url),
      ruta: `${interpretacion.origen || 'Santiago de Chile'} - ${destino}`,
      escalas: null,
      precio: null,
      moneda: interpretacion.moneda || 'CLP',
      url: r.url,
      precio_estimado: true
    },
    alojamiento: {
      nombre: 'Alojamiento por confirmar',
      ubicacion: destino,
      noches: interpretacion.cantidad_noches || 3,
      precio_total: null,
      moneda: interpretacion.moneda || 'CLP',
      valoracion: null,
      url: r.url,
      precio_estimado: true
    },
    traslado_local: {
      descripcion: 'Revisar traslado al destino final en el sitio del proveedor.',
      precio_estimado: null,
      moneda: interpretacion.moneda || 'CLP',
      url: r.url
    },
    total_estimado: null,
    moneda: interpretacion.moneda || 'CLP',
    dentro_presupuesto: null,
    diferencia_presupuesto: null,
    por_que_es_mejor: 'Resultado priorizado por relevancia de la búsqueda. Los precios y la disponibilidad deben confirmarse directamente con el proveedor.',
    url_reserva: r.url,
    advertencias: ['No fue posible completar el análisis local; verifica valores, fechas y disponibilidad en el enlace.']
  });

  return {
    resumen: webData.answer || 'Se encontraron referencias actuales para continuar la comparación.',
    criterios_interpretados: interpretacion,
    destino_solicitado: destino,
    aeropuerto_recomendado: {
      nombre: 'Por confirmar',
      codigo: '',
      ciudad: destino,
      es_alternativo: false,
      distancia_aprox_km: null,
      duracion_traslado: '',
      medio_traslado: '',
      motivo: 'Debe confirmarse según la opción seleccionada.'
    },
    mejor_opcion: principal.url ? {
      ...convertirAlternativa(principal, 0),
      titulo: 'Opción recomendada'
    } : null,
    alternativas: ordenados.slice(1, 4).map(convertirAlternativa)
  };
}

async function analizarResultadosConOllama(textoOriginal, interpretacion, webData) {
  const resultadosCompactos = webData.results.slice(0, 6).map((r, i) => ({
    id: i + 1,
    titulo: r.title,
    url: r.url,
    resumen: String(r.content || '').slice(0, 900),
    relevancia: r.score,
    fecha_publicacion: r.published_date
  }));

  const prompt = `Eres un comparador profesional de viajes. Elige la mejor opción usando EXCLUSIVAMENTE los resultados web entregados. Devuelve SOLO JSON válido y evita texto innecesario.

Solicitud original:
${textoOriginal}

Interpretación:
${JSON.stringify(interpretacion)}

Resumen del buscador:
${String(webData.answer || '').slice(0, 1500)}

Resultados web:
${JSON.stringify(resultadosCompactos)}

Reglas:
1. Selecciona una sola alternativa como mejor opción.
2. Si el destino no tiene aeropuerto, elige el aeropuerto práctico más cercano y explica el traslado.
3. Compara precio, duración, escalas, ubicación, calidad, confiabilidad y practicidad.
4. No inventes precios, disponibilidad, proveedores ni URLs. Usa null cuando falte un dato.
5. Las URLs deben coincidir exactamente con las URLs entregadas.
6. Indica qué debe confirmarse en el sitio del proveedor.
7. Si no hay tarifas claras, usa la mejor referencia disponible sin fabricar cifras.
8. Si hay presupuesto, indica si cumple solo cuando existan valores suficientes.
9. Incluye como máximo tres alternativas.

Formato:
{
  "resumen": "",
  "criterios_interpretados": ${JSON.stringify(interpretacion)},
  "destino_solicitado": "",
  "aeropuerto_recomendado": {
    "nombre": "",
    "codigo": "",
    "ciudad": "",
    "es_alternativo": false,
    "distancia_aprox_km": null,
    "duracion_traslado": "",
    "medio_traslado": "",
    "motivo": ""
  },
  "mejor_opcion": {
    "titulo": "Opción recomendada",
    "origen": "",
    "destino_final": "",
    "aeropuerto_llegada": "",
    "fechas": "",
    "personas": 1,
    "vuelo": {"proveedor":"","ruta":"","escalas":null,"precio":null,"moneda":"CLP","url":"","precio_estimado":true},
    "alojamiento": {"nombre":"","ubicacion":"","noches":null,"precio_total":null,"moneda":"CLP","valoracion":null,"url":"","precio_estimado":true},
    "traslado_local": {"descripcion":"","precio_estimado":null,"moneda":"CLP","url":""},
    "total_estimado": null,
    "moneda": "CLP",
    "dentro_presupuesto": null,
    "diferencia_presupuesto": null,
    "por_que_es_mejor": "",
    "url_reserva": "",
    "advertencias": []
  },
  "alternativas": []
}`;

  const { json, model } = await llamarOllama(
    [{ role: 'user', content: prompt }],
    { temperature: 0.05, numPredict: 2200 }
  );
  return { datos: json, model };
}

async function guardarResultado({ consulta, interpretacion, datos, fuentes }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const fuenteIds = [];

    for (const fuente of fuentes) {
      const [result] = await connection.query(
        `INSERT INTO fuentes_web (titulo, url, dominio, tipo, consulta_usuario, contenido_resumen)
         VALUES (?, ?, ?, 'viaje', ?, ?)`,
        [fuente.titulo, fuente.url, fuente.dominio, consulta, String(fuente.resumen || '').slice(0, 4000)]
      );
      fuenteIds.push(result.insertId);
    }

    const opciones = [datos?.mejor_opcion, ...(datos?.alternativas || [])].filter(Boolean);
    for (let i = 0; i < opciones.length; i += 1) {
      const opcion = opciones[i];
      const url = limpiarUrl(opcion.url_reserva || opcion.vuelo?.url || opcion.alojamiento?.url || fuentes[0]?.url || '');
      if (!url) continue;
      await connection.query(
        `INSERT INTO resultados_web_viajes
         (fuente_id, origen, destino, tipo, nombre, precio_estimado, moneda, url, descripcion, fecha_consulta)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          fuenteIds[0] || null,
          opcion.origen || interpretacion.origen || null,
          opcion.destino_final || interpretacion.destino || null,
          i === 0 ? 'mejor_opcion' : 'alternativa',
          opcion.titulo || `Opción ${i + 1}`,
          Number(opcion.total_estimado || 0) || null,
          opcion.moneda || interpretacion.moneda || 'CLP',
          url,
          JSON.stringify(opcion).slice(0, 12000)
        ]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.warn('No se pudo almacenar la búsqueda web:', error.message);
  } finally {
    connection.release();
  }
}

async function buscarEnWeb(filtros, textoOriginal = '') {
  if (!webEstaConfigurada()) {
    return {
      usada: false,
      respuesta: '',
      fuentes: [],
      datos: null,
      motivo: 'Falta configurar el servicio de búsqueda en el archivo .env.'
    };
  }

  let interpretacion;
  try {
    interpretacion = await interpretarSolicitudConOllama(textoOriginal, filtros);
  } catch (error) {
    console.warn('Interpretación local no disponible, se usará una interpretación básica:', error.message);
    interpretacion = interpretacionFallback(textoOriginal, filtros);
  }

  const query = construirConsultaTavily(interpretacion, textoOriginal);
  const webData = await buscarConTavily(query);

  if (!webData.results.length) {
    throw new Error('No se encontraron resultados actuales para esta búsqueda.');
  }

  let analisis;
  try {
    analisis = await analizarResultadosConOllama(textoOriginal, interpretacion, webData);
  } catch (error) {
    console.warn('Análisis local no disponible, se mostrará una comparación básica:', error.message);
    analisis = {
      datos: crearAnalisisFallback(interpretacion, webData),
      model: process.env.OLLAMA_MODEL || 'local'
    };
  }

  const fuentes = webData.results.map((r) => ({
    titulo: r.title || dominioDe(r.url) || 'Fuente web',
    url: r.url,
    dominio: dominioDe(r.url),
    resumen: r.content,
    relevancia: r.score
  }));

  await guardarResultado({
    consulta: textoOriginal,
    interpretacion,
    datos: analisis.datos,
    fuentes
  });

  return {
    usada: true,
    proveedor: 'Comparador web',
    modelo: analisis.model,
    consulta_web: query,
    respuesta: webData.answer,
    fuentes,
    interpretacion,
    datos: analisis.datos
  };
}

module.exports = {
  buscarEnWeb,
  webEstaConfigurada,
  llamarOllama,
  interpretarSolicitudConOllama,
  buscarConTavily
};
