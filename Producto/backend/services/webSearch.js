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


function numeroMonetario(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  if (typeof valor === 'number') return Number.isFinite(valor) && valor >= 0 ? valor : null;

  let texto = String(valor).trim();
  if (!texto) return null;
  texto = texto.replace(/[^0-9,.-]/g, '');
  if (!texto) return null;

  const tieneComa = texto.includes(',');
  const tienePunto = texto.includes('.');
  if (tieneComa && tienePunto) {
    const ultimoSeparador = Math.max(texto.lastIndexOf(','), texto.lastIndexOf('.'));
    const enteros = texto.slice(0, ultimoSeparador).replace(/[.,]/g, '');
    const decimales = texto.slice(ultimoSeparador + 1).replace(/[.,]/g, '');
    texto = `${enteros}.${decimales}`;
  } else if (tieneComa || tienePunto) {
    const separador = tieneComa ? ',' : '.';
    const partes = texto.split(separador);
    const ultima = partes[partes.length - 1];
    if (partes.length > 2 || ultima.length === 3) texto = partes.join('');
    else texto = partes.join('.');
  }

  const numero = Number(texto);
  return Number.isFinite(numero) && numero >= 0 ? numero : null;
}

function totalOpcion(opcion = {}) {
  const totalDeclarado = numeroMonetario(opcion.total_estimado);
  if (totalDeclarado !== null) return totalDeclarado;

  const vuelo = numeroMonetario(opcion.vuelo?.precio);
  const alojamiento = numeroMonetario(opcion.alojamiento?.precio_total);
  if (vuelo === null || alojamiento === null) return null;
  return vuelo + alojamiento;
}

function aplicarPresupuestoEstricto(datos = {}, interpretacion = {}) {
  const presupuesto = numeroMonetario(interpretacion.presupuesto_total);
  if (presupuesto === null || presupuesto <= 0) {
    return { ...datos, presupuesto_estricto: false };
  }

  const originales = [datos.mejor_opcion, ...(Array.isArray(datos.alternativas) ? datos.alternativas : [])]
    .filter(Boolean);
  const dentro = [];

  for (const opcionOriginal of originales) {
    const total = totalOpcion(opcionOriginal);
    if (total === null || total > presupuesto) continue;

    dentro.push({
      ...opcionOriginal,
      total_estimado: total,
      moneda: opcionOriginal.moneda || interpretacion.moneda || 'CLP',
      dentro_presupuesto: true,
      diferencia_presupuesto: Math.max(0, presupuesto - total),
      presupuesto_maximo: presupuesto
    });
  }

  // Mantiene el orden de calidad definido por el analizador, pero jamás promueve
  // una opción que supere el presupuesto o cuyo total no pueda verificarse.
  const mejor = dentro[0] || null;
  const alternativas = dentro.slice(1, 4);

  if (!mejor) {
    const mensaje = `No se encontró una combinación verificable de vuelo y alojamiento por un total máximo de ${Math.round(presupuesto)} ${interpretacion.moneda || 'CLP'}. No se mostrarán opciones que superen ese límite.`;
    return {
      ...datos,
      mejor_opcion: null,
      alternativas: [],
      presupuesto_estricto: true,
      presupuesto_maximo: presupuesto,
      sin_opciones_dentro_presupuesto: true,
      mensaje_presupuesto: mensaje,
      resumen: mensaje
    };
  }

  return {
    ...datos,
    mejor_opcion: mejor,
    alternativas,
    presupuesto_estricto: true,
    presupuesto_maximo: presupuesto,
    sin_opciones_dentro_presupuesto: false,
    mensaje_presupuesto: `Todas las opciones mostradas respetan el límite máximo de ${Math.round(presupuesto)} ${interpretacion.moneda || 'CLP'}.`
  };
}

function textoErrorServicio(valor) {
  if (valor === undefined || valor === null || valor === '') return '';
  if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') {
    return String(valor);
  }
  if (Array.isArray(valor)) {
    return [...new Set(valor.map(textoErrorServicio).filter(Boolean))].join(' | ');
  }
  if (typeof valor === 'object') {
    const mensaje = valor.message || valor.msg || valor.reason || valor.description || valor.error;
    const ubicacion = Array.isArray(valor.loc) ? valor.loc.join('.') : '';
    const detalle = valor.detail && valor.detail !== valor ? textoErrorServicio(valor.detail) : '';
    const partes = [textoErrorServicio(mensaje), detalle]
      .filter(Boolean)
      .map((texto) => ubicacion && !texto.includes(ubicacion) ? `${texto} (${ubicacion})` : texto);
    if (partes.length) return [...new Set(partes)].join(' | ');
    try { return JSON.stringify(valor); } catch (_) { return 'Error sin detalle legible'; }
  }
  return String(valor);
}

function crearErrorTavily(response) {
  const status = Number(response?.status || 0);
  const payload = response?.payload || {};
  const detalle = textoErrorServicio(
    payload.detail || payload.message || payload.error || payload.errors || payload
  );

  let mensaje;
  if (status === 400) {
    mensaje = `La solicitud enviada al buscador no fue válida${detalle ? `: ${detalle}` : '.'}`;
  } else if (status === 401 || status === 403) {
    mensaje = 'La clave de Tavily no es válida o no tiene autorización.';
  } else if (status === 429 || status === 432 || status === 433) {
    mensaje = `Tavily no tiene cuota disponible o alcanzó su límite de uso${detalle ? `: ${detalle}` : '.'}`;
  } else if (status >= 500) {
    mensaje = `Tavily presentó un problema temporal${detalle ? `: ${detalle}` : '.'}`;
  } else {
    mensaje = `El servicio de búsqueda respondió HTTP ${status || 'desconocido'}${detalle ? `: ${detalle}` : ''}`;
  }

  const error = new Error(mensaje);
  error.tavilyStatus = status;
  error.httpStatus = [429, 432, 433].includes(status) ? 429 : (status === 401 || status === 403 ? 503 : 502);
  return error;
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

function construirConsultasTavily(interpretacion, textoOriginal) {
  const viajeros = Math.max(1, Number(interpretacion.adultos || 1) + Number(interpretacion.ninos || 0));
  const origen = interpretacion.origen || 'Santiago de Chile';
  const destino = interpretacion.destino_abierto || !interpretacion.destino
    ? 'destino económico recomendado desde Chile'
    : interpretacion.destino;
  const fechaIda = interpretacion.fecha_ida || 'fechas flexibles';
  const fechaVuelta = interpretacion.fecha_vuelta || '';
  const fechas = fechaVuelta ? `${fechaIda} a ${fechaVuelta}` : fechaIda;
  const noches = Math.max(1, Number(interpretacion.cantidad_noches || 3));
  const presupuestoNumero = numeroMonetario(interpretacion.presupuesto_total);
  const presupuesto = presupuestoNumero
    ? `${presupuestoNumero} ${interpretacion.moneda || 'CLP'} como máximo para vuelo y alojamiento juntos`
    : 'mejor precio disponible';

  // Las consultas incluyen el límite total para aumentar la probabilidad de recibir
  // tarifas que puedan combinarse sin exceder el presupuesto indicado.
  return {
    vuelos: `vuelos ida y vuelta reservables desde ${origen} hacia ${destino}, ${fechas}, ${viajeros} pasajero(s), precio total final para todos los pasajeros, viaje completo con presupuesto ${presupuesto}, aerolíneas y enlaces de reserva`,
    vuelos_respaldo: `vuelos ${origen} ${destino} ${fechas} ${viajeros} pasajeros precio total reservar presupuesto máximo ${presupuesto}`,
    alojamientos: `alojamientos reservables en ${destino}, ${noches} noches, ${viajeros} huésped(es), precio total de toda la estadía, viaje completo con presupuesto ${presupuesto}, enlaces de reserva`,
    alojamientos_respaldo: `hoteles alojamientos ${destino} ${noches} noches ${viajeros} huéspedes precio total reservar presupuesto máximo ${presupuesto}`,
    solicitud_original: String(textoOriginal || '').trim()
  };
}

async function buscarConTavily(query, categoria = 'general') {
  const timeoutMs = Number(process.env.TAVILY_TIMEOUT_MS || 90000);
  const maxResults = Math.min(8, Math.max(3, Number(process.env.TAVILY_MAX_RESULTS || 6)));
  const queryLimpia = String(query || '').replace(/\s+/g, ' ').trim().slice(0, 380);

  if (!queryLimpia) {
    const error = new Error(`La consulta de ${categoria} está vacía.`);
    error.httpStatus = 400;
    throw error;
  }

  let response;
  try {
    response = await solicitarJson('https://api.tavily.com/search', {
      timeoutMs,
      etiqueta: 'El servicio de búsqueda',
      headers: {
        Authorization: `Bearer ${process.env.TAVILY_API_KEY.trim()}`
      },
      body: {
        query: queryLimpia,
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
    throw crearErrorTavily(response);
  }

  const payload = response.payload || {};
  const results = Array.isArray(payload.results) ? payload.results : [];
  return {
    answer: payload.answer || '',
    query: payload.query || queryLimpia,
    response_time: payload.response_time || null,
    categoria,
    results: results.map((r) => ({
      title: r.title || dominioDe(r.url),
      url: limpiarUrl(r.url),
      content: String(r.content || '').slice(0, 1100),
      score: Number(r.score || 0),
      published_date: r.published_date || null,
      categoria
    })).filter((r) => r.url)
  };
}

function combinarResultadosWeb(busquedas = []) {
  const vistos = new Set();
  const results = [];
  const answers = [];
  const queries = {};

  for (const busqueda of busquedas) {
    if (!busqueda) continue;
    const categoria = busqueda.categoria || 'general';
    queries[categoria] = busqueda.query || '';
    if (busqueda.answer) answers.push(`[${categoria}] ${busqueda.answer}`);

    for (const resultado of busqueda.results || []) {
      const clave = resultado.url.toLowerCase();
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      results.push({ ...resultado, categoria: resultado.categoria || categoria });
    }
  }

  return {
    answer: answers.join('\n\n'),
    query: queries,
    results,
    por_categoria: {
      vuelos: results.filter((r) => r.categoria === 'vuelos'),
      alojamientos: results.filter((r) => r.categoria === 'alojamientos')
    }
  };
}

async function buscarCategoriaConRespaldo(principal, respaldo, categoria) {
  const consultas = [...new Set([principal, respaldo].filter(Boolean))];
  const errores = [];
  const exitosos = [];

  for (let i = 0; i < consultas.length; i += 1) {
    try {
      const resultado = await buscarConTavily(consultas[i], categoria);
      exitosos.push(resultado);
      const combinado = combinarResultadosWeb(exitosos);
      const cantidad = combinado.por_categoria[categoria]?.length || 0;
      if (cantidad >= 2 || i === consultas.length - 1) {
        return { resultado: combinado, errores };
      }
    } catch (error) {
      errores.push(error);
      // Una clave inválida o falta de cuota no se corrige repitiendo la consulta.
      if ([401, 403, 429, 432, 433].includes(Number(error.tavilyStatus || 0))) break;
    }
  }

  return { resultado: combinarResultadosWeb(exitosos), errores };
}

async function buscarCategoriasObligatorias(consultas) {
  const [vuelos, alojamientos] = await Promise.all([
    buscarCategoriaConRespaldo(consultas.vuelos, consultas.vuelos_respaldo, 'vuelos'),
    buscarCategoriaConRespaldo(consultas.alojamientos, consultas.alojamientos_respaldo, 'alojamientos')
  ]);

  const combinado = combinarResultadosWeb([
    ...(vuelos.resultado?.results?.length ? [{
      categoria: 'vuelos',
      query: vuelos.resultado.query?.vuelos || consultas.vuelos,
      answer: vuelos.resultado.answer || '',
      results: vuelos.resultado.por_categoria?.vuelos || []
    }] : []),
    ...(alojamientos.resultado?.results?.length ? [{
      categoria: 'alojamientos',
      query: alojamientos.resultado.query?.alojamientos || consultas.alojamientos,
      answer: alojamientos.resultado.answer || '',
      results: alojamientos.resultado.por_categoria?.alojamientos || []
    }] : [])
  ]);

  if (!combinado.por_categoria.vuelos.length) {
    const errorBase = vuelos.errores[0];
    const detalle = vuelos.errores.map((e) => e.message).filter(Boolean).join(' | ');
    const error = new Error(`No fue posible obtener opciones de vuelos${detalle ? `: ${detalle}` : '. Intenta con un origen, destino o fechas diferentes.'}`);
    error.httpStatus = errorBase?.httpStatus || 502;
    throw error;
  }

  if (!combinado.por_categoria.alojamientos.length) {
    const errorBase = alojamientos.errores[0];
    const detalle = alojamientos.errores.map((e) => e.message).filter(Boolean).join(' | ');
    const error = new Error(`No fue posible obtener opciones de alojamiento${detalle ? `: ${detalle}` : '. Intenta con un destino o fechas diferentes.'}`);
    error.httpStatus = errorBase?.httpStatus || 502;
    throw error;
  }

  return combinado;
}

function crearAnalisisFallback(interpretacion, webData) {
  const vuelos = [...(webData.por_categoria?.vuelos || [])]
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  const alojamientos = [...(webData.por_categoria?.alojamientos || [])]
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  const destino = interpretacion.destino || 'Destino por confirmar';
  const personas = Math.max(1, Number(interpretacion.adultos || 1) + Number(interpretacion.ninos || 0));
  const noches = Math.max(1, Number(interpretacion.cantidad_noches || 3));

  const construirOpcion = (vueloFuente, alojamientoFuente, indice) => {
    if (!vueloFuente || !alojamientoFuente) return null;
    return {
      titulo: indice === 0 ? 'Opción recomendada' : `Alternativa ${indice + 1}`,
      origen: interpretacion.origen || 'Santiago de Chile',
      destino_final: destino,
      aeropuerto_llegada: 'Por confirmar con el proveedor',
      fechas: interpretacion.fecha_ida || 'Fechas flexibles',
      personas,
      vuelo: {
        proveedor: dominioDe(vueloFuente.url),
        ruta: `${interpretacion.origen || 'Santiago de Chile'} - ${destino}`,
        escalas: null,
        precio: null,
        moneda: interpretacion.moneda || 'CLP',
        url: vueloFuente.url,
        precio_estimado: true
      },
      alojamiento: {
        nombre: alojamientoFuente.title || 'Alojamiento disponible',
        ubicacion: destino,
        noches,
        precio_total: null,
        moneda: interpretacion.moneda || 'CLP',
        valoracion: null,
        url: alojamientoFuente.url,
        precio_estimado: true
      },
      total_estimado: null,
      moneda: interpretacion.moneda || 'CLP',
      dentro_presupuesto: null,
      diferencia_presupuesto: null,
      por_que_es_mejor: 'Combina una referencia de vuelo y una referencia de alojamiento priorizadas por relevancia. Confirma precios y disponibilidad directamente en cada proveedor.',
      url_reserva: vueloFuente.url,
      advertencias: ['Los precios no pudieron estructurarse automáticamente; revisa por separado el vuelo y el alojamiento.']
    };
  };

  const cantidad = Math.min(3, vuelos.length, alojamientos.length);
  const opciones = Array.from({ length: cantidad }, (_, i) => construirOpcion(vuelos[i], alojamientos[i], i)).filter(Boolean);

  return {
    resumen: webData.answer || 'Se encontraron referencias actuales de vuelos y alojamientos para comparar.',
    criterios_interpretados: interpretacion,
    destino_solicitado: destino,
    aeropuerto_recomendado: {
      nombre: 'Por confirmar',
      codigo: '',
      ciudad: destino,
      es_alternativo: false,
      motivo: 'Se prioriza el aeropuerto más conveniente para la ruta seleccionada.'
    },
    mejor_opcion: opciones[0] || null,
    alternativas: opciones.slice(1),
    resultados_vuelos: vuelos,
    resultados_alojamientos: alojamientos
  };
}

async function analizarResultadosConOllama(textoOriginal, interpretacion, webData) {
  const vuelosCompactos = (webData.por_categoria?.vuelos || []).slice(0, 5).map((r, i) => ({
    id: `V${i + 1}`,
    categoria: 'vuelo',
    titulo: r.title,
    url: r.url,
    resumen: String(r.content || '').slice(0, 850),
    relevancia: r.score,
    fecha_publicacion: r.published_date
  }));

  const alojamientosCompactos = (webData.por_categoria?.alojamientos || []).slice(0, 5).map((r, i) => ({
    id: `A${i + 1}`,
    categoria: 'alojamiento',
    titulo: r.title,
    url: r.url,
    resumen: String(r.content || '').slice(0, 850),
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

Resultados de vuelos:
${JSON.stringify(vuelosCompactos)}

Resultados de alojamientos:
${JSON.stringify(alojamientosCompactos)}

Reglas:
1. Selecciona una sola alternativa como mejor opción, pero SIEMPRE debe incluir un vuelo y un alojamiento.
2. El campo vuelo.url debe usar exclusivamente una URL de los resultados de vuelos.
3. El campo alojamiento.url debe usar exclusivamente una URL de los resultados de alojamientos.
4. No uses la misma fuente para vuelo y alojamiento, salvo que el resultado corresponda claramente a un paquete que incluya ambos.
5. Si el destino no tiene aeropuerto, elige el aeropuerto comercial más práctico y explica por qué es la mejor alternativa aérea.
6. Compara precio, duración, escalas, ubicación, calidad, valoración, confiabilidad, cancelación y practicidad.
7. No inventes precios, disponibilidad, proveedores ni URLs. Usa null cuando falte un dato.
8. Las URLs deben coincidir exactamente con las URLs entregadas.
9. Indica qué debe confirmarse en el sitio de cada proveedor.
10. Si no hay tarifas claras, usa la mejor referencia disponible sin fabricar cifras.
11. Si existe presupuesto_total, es un límite máximo estricto e inquebrantable para vuelo y alojamiento juntos.
12. Con presupuesto_total, calcula total_estimado como vuelo.precio + alojamiento.precio_total. El precio del vuelo debe corresponder al total para todos los pasajeros y el alojamiento al total de todas las noches.
13. Con presupuesto_total, NO incluyas, recomiendes ni marques como alternativa ninguna opción cuyo total_estimado sea mayor al presupuesto. Tampoco incluyas opciones con total desconocido.
14. Si ninguna combinación verificable cumple el presupuesto, devuelve mejor_opcion=null y alternativas=[]; no muestres una opción cercana que se pase del monto.
15. Incluye como máximo tres alternativas, y cada alternativa también debe incluir vuelo y alojamiento.
16. No declares una opción como completa si falta alojamiento.

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

function opcionIncluyeVueloYAlojamiento(opcion) {
  return Boolean(
    opcion &&
    opcion.vuelo &&
    limpiarUrl(opcion.vuelo.url || '') &&
    opcion.alojamiento &&
    limpiarUrl(opcion.alojamiento.url || '') &&
    (opcion.alojamiento.nombre || opcion.alojamiento.ubicacion)
  );
}

function asegurarOpcionesCompletas(datos, interpretacion, webData) {
  const fallback = crearAnalisisFallback(interpretacion, webData);
  const mejorValida = opcionIncluyeVueloYAlojamiento(datos?.mejor_opcion)
    ? datos.mejor_opcion
    : fallback.mejor_opcion;

  const alternativasValidas = (datos?.alternativas || [])
    .filter(opcionIncluyeVueloYAlojamiento)
    .slice(0, 3);

  if (alternativasValidas.length < 2) {
    for (const alternativa of fallback.alternativas || []) {
      if (alternativasValidas.length >= 2) break;
      if (opcionIncluyeVueloYAlojamiento(alternativa)) alternativasValidas.push(alternativa);
    }
  }

  return {
    ...fallback,
    ...(datos || {}),
    mejor_opcion: mejorValida,
    alternativas: alternativasValidas,
    resultados_vuelos: webData.por_categoria?.vuelos || [],
    resultados_alojamientos: webData.por_categoria?.alojamientos || []
  };
}


function normalizarCriteriosPresentacion(datos = {}, interpretacion = {}) {
  const existentes = datos.criterios_interpretados || {};
  const destino = String(
    interpretacion.destino ||
    existentes.destino ||
    existentes.destino_o_zona ||
    datos.destino_solicitado ||
    datos.mejor_opcion?.destino_final ||
    ''
  ).trim();
  const origen = String(
    interpretacion.origen ||
    existentes.origen ||
    datos.mejor_opcion?.origen ||
    ''
  ).trim();

  const viajerosNumero = Math.max(
    1,
    Number(interpretacion.adultos || 1) + Number(interpretacion.ninos || 0)
  );
  const presupuesto = numeroMonetario(interpretacion.presupuesto_total);
  const moneda = interpretacion.moneda || existentes.moneda || 'CLP';

  const supuestos = Array.isArray(existentes.supuestos_utilizados)
    ? existentes.supuestos_utilizados
    : (Array.isArray(interpretacion.supuestos) ? interpretacion.supuestos : []);

  const supuestosLimpios = destino
    ? supuestos.filter((s) => !/destino\s+flexible|destino\s+abierto/i.test(String(s || '')))
    : supuestos;

  return {
    ...existentes,
    origen,
    destino,
    destino_o_zona: destino,
    fechas_o_flexibilidad: existentes.fechas_o_flexibilidad ||
      (interpretacion.fecha_ida
        ? `${interpretacion.fecha_ida}${interpretacion.fecha_vuelta ? ` a ${interpretacion.fecha_vuelta}` : ''}`
        : 'Fechas flexibles'),
    duracion: existentes.duracion || `${Math.max(1, Number(interpretacion.cantidad_noches || 3))} noches`,
    viajeros: existentes.viajeros || `${viajerosNumero} persona(s)`,
    presupuesto: existentes.presupuesto || (presupuesto ? `${Math.round(presupuesto)} ${moneda}` : 'No indicado'),
    tipo_viaje: existentes.tipo_viaje || interpretacion.tipo_viaje || 'General',
    prioridades: Array.isArray(existentes.prioridades) ? existentes.prioridades : (interpretacion.prioridades || []),
    preferencias: Array.isArray(existentes.preferencias) ? existentes.preferencias : (interpretacion.preferencias || []),
    supuestos_utilizados: supuestosLimpios
  };
}

async function guardarResultado({ consulta, interpretacion, datos, fuentes }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const fuenteIds = [];

    for (const fuente of fuentes) {
      const [result] = await connection.query(
        `INSERT INTO fuentes_web (titulo, url, dominio, tipo, consulta_usuario, contenido_resumen)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          fuente.titulo,
          fuente.url,
          fuente.dominio,
          fuente.tipo || 'viaje',
          consulta,
          String(fuente.resumen || '').slice(0, 4000)
        ]
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

  const interpretacionBase = interpretacionFallback(textoOriginal, filtros);
  const destinoExplicito = String(
    filtros?.destino ||
    interpretacionBase.destino ||
    interpretacion?.destino ||
    ''
  ).trim();

  const supuestosNormalizados = Array.isArray(interpretacion?.supuestos)
    ? interpretacion.supuestos.filter((supuesto) => {
        if (!destinoExplicito) return true;
        return !/destino\s+flexible|destino\s+abierto/i.test(String(supuesto || ''));
      })
    : interpretacionBase.supuestos;

  interpretacion = {
    ...interpretacionBase,
    ...(interpretacion || {}),
    origen: String(filtros?.origen || interpretacion?.origen || interpretacionBase.origen || '').trim(),
    destino: destinoExplicito,
    // Un destino indicado por el usuario siempre tiene prioridad sobre una inferencia de destino abierto.
    destino_abierto: destinoExplicito ? false : Boolean(interpretacion?.destino_abierto),
    supuestos: supuestosNormalizados,
    presupuesto_total: numeroMonetario(interpretacion?.presupuesto_total)
      || numeroMonetario(filtros?.presupuesto_total)
      || null,
    moneda: interpretacion?.moneda || filtros?.moneda || 'CLP'
  };

  const consultas = construirConsultasTavily(interpretacion, textoOriginal);
  const webData = await buscarCategoriasObligatorias(consultas);

  if (!webData.por_categoria.vuelos.length || !webData.por_categoria.alojamientos.length) {
    throw new Error('La búsqueda debe incluir tanto vuelos como alojamientos.');
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

  analisis.datos = asegurarOpcionesCompletas(analisis.datos, interpretacion, webData);
  analisis.datos = aplicarPresupuestoEstricto(analisis.datos, interpretacion);
  analisis.datos.destino_solicitado = interpretacion.destino || analisis.datos.destino_solicitado || '';
  analisis.datos.criterios_interpretados = normalizarCriteriosPresentacion(analisis.datos, interpretacion);

  const fuentes = webData.results.map((r) => ({
    titulo: r.title || dominioDe(r.url) || 'Fuente web',
    url: r.url,
    dominio: dominioDe(r.url),
    resumen: r.content,
    relevancia: r.score,
    tipo: r.categoria || 'viaje'
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
    consulta_web: consultas,
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
  buscarConTavily,
  construirConsultasTavily,
  buscarCategoriasObligatorias,
  numeroMonetario,
  totalOpcion,
  aplicarPresupuestoEstricto
};
