const express = require('express');
const { parseWithAI } = require('../services/searchParser');
const { buscarEnWeb } = require('../services/webSearch');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const texto = String(req.body.texto || req.body.q || '').trim();
    if (!texto && !req.body.destino) {
      return res.status(400).json({ ok: false, message: 'Escribe una solicitud de viaje o indica un destino.' });
    }

    const filtros = await parseWithAI({ ...req.body, buscar_web: true });
    const web = await buscarEnWeb(filtros, texto);

    if (!web.usada) {
      return res.status(503).json({ ok: false, message: web.motivo || 'No fue posible consultar internet.' });
    }

    const mejor = web.datos?.mejor_opcion || null;
    res.json({
      ok: true,
      origen_datos: 'web',
      base_consultada: false,
      filtros,
      interpretacion: web.interpretacion,
      mensaje: mejor ? 'Se encontró la mejor opción disponible en internet.' : 'La búsqueda terminó, pero no fue posible estructurar una opción completa.',
      ia: { usada: true, proveedor: web.proveedor, modelo: web.modelo },
      mejor_opcion: mejor,
      alternativas: web.datos?.alternativas || [],
      aeropuerto_recomendado: web.datos?.aeropuerto_recomendado || null,
      resumen: web.datos?.resumen || web.respuesta || '',
      web,
      vuelos: [],
      hoteles: [],
      resultados: []
    });
  } catch (error) {
    console.error('ERROR BUSQUEDA WEB:', error);
    const mensaje = error.message || 'No se pudo completar la búsqueda';
    const status = Number(error.httpStatus) || (/TAVILY_API_KEY|OLLAMA|configura/i.test(mensaje) ? 503 : 500);
    res.status(status).json({ ok: false, message: `No se pudo buscar la mejor opción en internet: ${mensaje}` });
  }
});

module.exports = router;
