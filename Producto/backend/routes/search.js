const express = require('express');
const pool = require('../db');
const { parseWithGemini } = require('../services/searchParser');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const filtros = await parseWithGemini(req.body);

    const intentos = [
      { exacto: true, usarFechas: true, usarOrigen: true, usarDestino: true },
      { exacto: false, usarFechas: true, usarOrigen: true, usarDestino: true },
      { exacto: false, usarFechas: false, usarOrigen: true, usarDestino: true },
      { exacto: false, usarFechas: false, usarOrigen: false, usarDestino: true },
      { exacto: false, usarFechas: false, usarOrigen: false, usarDestino: false }
    ];

    let data = { vuelos: [], hoteles: [] };
    let modo = 'sin-resultados';

    for (const intento of intentos) {
      data = await buscarViajes(filtros, intento);
      if (data.vuelos.length && data.hoteles.length) {
        modo = intento.usarFechas ? (intento.exacto ? 'coincidencia exacta' : 'fechas cercanas') : 'ruta disponible';
        break;
      }
    }

    const { vuelos, hoteles } = data;
    const economico = vuelos[0] || null;
    const mejorValorado = hoteles[0] || null;
    const noches = calcularNoches(filtros.fechaIda, filtros.fechaVuelta);
    const combinaciones = [];

    vuelos.slice(0, 12).forEach(vuelo => {
      hoteles.slice(0, 12).forEach(hotel => {
        combinaciones.push({
          vuelo,
          hotel,
          total_estimado: Number(vuelo.precio) + Number(hotel.precio_noche) * noches,
          noches
        });
      });
    });

    combinaciones.sort((a, b) => a.total_estimado - b.total_estimado || Number(b.hotel.puntuacion) - Number(a.hotel.puntuacion));

    res.json({
      ok: true,
      filtros,
      modo,
      encontrados: combinaciones.length,
      mensaje: combinaciones.length ? 'Resultados encontrados.' : 'No se encontraron viajes disponibles para la búsqueda seleccionada.',
      destacados: { economico, mejorValorado },
      vuelos,
      hoteles,
      resultados: combinaciones.slice(0, 12)
    });
  } catch (error) {
    console.error('ERROR BUSQUEDA:', error);
    res.status(500).json({ ok: false, message: 'No se pudo realizar la búsqueda.', detail: error.message });
  }
});

function normalizar(txt = '') {
  return String(txt).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

async function buscarViajes(filtros, opciones) {
  const flightParams = [];
  const hotelParams = [];
  let flightWhere = 'WHERE disponible = 1';
  let hotelWhere = 'WHERE disponible = 1';

  if (opciones.usarOrigen && filtros.origen) {
    flightWhere += ' AND LOWER(origen) LIKE ?';
    flightParams.push(`%${normalizar(filtros.origen)}%`);
  }

  if (opciones.usarDestino && filtros.destino) {
    flightWhere += ' AND LOWER(destino) LIKE ?';
    hotelWhere += ' AND LOWER(ciudad) LIKE ?';
    flightParams.push(`%${normalizar(filtros.destino)}%`);
    hotelParams.push(`%${normalizar(filtros.destino)}%`);
  }

  if (opciones.usarFechas && filtros.fechaIda) {
    if (opciones.exacto) {
      flightWhere += ' AND fecha_salida = ?';
      flightParams.push(filtros.fechaIda);
    } else {
      flightWhere += ' AND fecha_salida BETWEEN DATE_SUB(?, INTERVAL 10 DAY) AND DATE_ADD(?, INTERVAL 10 DAY)';
      flightParams.push(filtros.fechaIda, filtros.fechaIda);
    }
  }

  if (opciones.usarFechas && filtros.fechaVuelta) {
    if (opciones.exacto) {
      flightWhere += ' AND fecha_regreso = ?';
      flightParams.push(filtros.fechaVuelta);
    } else {
      flightWhere += ' AND fecha_regreso BETWEEN DATE_SUB(?, INTERVAL 10 DAY) AND DATE_ADD(?, INTERVAL 10 DAY)';
      flightParams.push(filtros.fechaVuelta, filtros.fechaVuelta);
    }
  }

  const [vuelos] = await pool.query(
    `SELECT * FROM vuelos ${flightWhere} ORDER BY precio ASC, puntuacion DESC LIMIT 40`,
    flightParams
  );

  const [hoteles] = await pool.query(
    `SELECT * FROM hoteles ${hotelWhere} ORDER BY puntuacion DESC, precio_noche ASC LIMIT 40`,
    hotelParams
  );

  return { vuelos, hoteles };
}

function calcularNoches(ida, vuelta) {
  if (!ida || !vuelta) return 3;
  const a = new Date(ida);
  const b = new Date(vuelta);
  const diff = Math.round((b - a) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 1;
}

module.exports = router;
