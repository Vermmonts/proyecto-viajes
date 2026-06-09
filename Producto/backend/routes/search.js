const express = require('express');
const pool = require('../db');
const { parseWithGemini } = require('../services/searchParser');

const router = express.Router();

const cache = { vuelos: null, hoteles: null };

async function getColumns(table) {
  if (cache[table]) return cache[table];
  const [cols] = await pool.query(`SHOW COLUMNS FROM ${table}`);
  cache[table] = new Set(cols.map(c => c.Field));
  return cache[table];
}

function normalizar(txt = '') {
  return String(txt).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function contiene(a, b) {
  if (!b) return true;
  return normalizar(a).includes(normalizar(b));
}

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

    combinaciones.sort((a, b) => a.total_estimado - b.total_estimado || Number(b.hotel.puntuacion || 0) - Number(a.hotel.puntuacion || 0));

    res.json({
      ok: true,
      filtros,
      modo,
      encontrados: combinaciones.length,
      mensaje: combinaciones.length ? 'Resultados encontrados.' : 'No se encontraron viajes disponibles para la búsqueda seleccionada.',
      ia: { usada: Boolean(filtros.ia_usada), modelo: filtros.ia_modelo || null, motivo: filtros.ia_motivo || null },
      destacados: { economico, mejorValorado },
      vuelos,
      hoteles,
      resultados: combinaciones.slice(0, 12)
    });
  } catch (error) {
    console.error('ERROR BUSQUEDA:', error);
    res.status(500).json({ ok: false, message: `No se pudo realizar la búsqueda: ${error.message}` });
  }
});

async function buscarViajes(filtros, opciones) {
  const vueloCols = await getColumns('vuelos');
  const hotelCols = await getColumns('hoteles');

  const flightParams = [];
  const hotelParams = [];
  let flightWhere = 'WHERE 1=1';
  let hotelWhere = 'WHERE 1=1';

  if (vueloCols.has('disponible')) flightWhere += ' AND disponible = 1';
  if (hotelCols.has('disponible')) hotelWhere += ' AND disponible = 1';

  if (opciones.usarOrigen && filtros.origen) {
    flightWhere += ' AND LOWER(origen) LIKE ?';
    flightParams.push(`%${String(filtros.origen).toLowerCase()}%`);
  }

  if (opciones.usarDestino && filtros.destino) {
    flightWhere += ' AND LOWER(destino) LIKE ?';
    hotelWhere += ' AND LOWER(ciudad) LIKE ?';
    flightParams.push(`%${String(filtros.destino).toLowerCase()}%`);
    hotelParams.push(`%${String(filtros.destino).toLowerCase()}%`);
  }

  if (opciones.usarFechas && filtros.fechaIda && vueloCols.has('fecha_salida')) {
    if (opciones.exacto) {
      flightWhere += ' AND fecha_salida = ?';
      flightParams.push(filtros.fechaIda);
    } else {
      flightWhere += ' AND fecha_salida BETWEEN DATE_SUB(?, INTERVAL 10 DAY) AND DATE_ADD(?, INTERVAL 10 DAY)';
      flightParams.push(filtros.fechaIda, filtros.fechaIda);
    }
  }

  if (opciones.usarFechas && filtros.fechaVuelta && vueloCols.has('fecha_regreso')) {
    if (opciones.exacto) {
      flightWhere += ' AND fecha_regreso = ?';
      flightParams.push(filtros.fechaVuelta);
    } else {
      flightWhere += ' AND fecha_regreso BETWEEN DATE_SUB(?, INTERVAL 10 DAY) AND DATE_ADD(?, INTERVAL 10 DAY)';
      flightParams.push(filtros.fechaVuelta, filtros.fechaVuelta);
    }
  }

  const vueloPuntuacion = vueloCols.has('puntuacion') ? 'puntuacion' : '4.0 AS puntuacion';
  const vueloDisponible = vueloCols.has('disponible') ? 'disponible' : '1 AS disponible';
  const horaSalida = vueloCols.has('hora_salida') ? 'hora_salida' : 'NULL AS hora_salida';
  const horaRegreso = vueloCols.has('hora_regreso') ? 'hora_regreso' : 'NULL AS hora_regreso';

  let hotelPuntuacion = '4.0 AS puntuacion';
  if (hotelCols.has('puntuacion')) hotelPuntuacion = 'puntuacion';
  else if (hotelCols.has('valoracion')) hotelPuntuacion = 'valoracion AS puntuacion';
  const hotelImagen = hotelCols.has('imagen') ? 'imagen' : 'NULL AS imagen';
  const hotelDisponible = hotelCols.has('disponible') ? 'disponible' : '1 AS disponible';

  const vueloOrder = vueloCols.has('puntuacion') ? 'ORDER BY precio ASC, puntuacion DESC' : 'ORDER BY precio ASC';
  const hotelOrder = hotelCols.has('puntuacion') ? 'ORDER BY puntuacion DESC, precio_noche ASC' : (hotelCols.has('valoracion') ? 'ORDER BY valoracion DESC, precio_noche ASC' : 'ORDER BY precio_noche ASC');

  const [vuelos] = await pool.query(
    `SELECT id, aerolinea, origen, destino, fecha_salida, fecha_regreso, precio, escalas, ${horaSalida}, ${horaRegreso}, ${vueloPuntuacion}, ${vueloDisponible}
     FROM vuelos ${flightWhere} ${vueloOrder} LIMIT 40`,
    flightParams
  );

  const [hoteles] = await pool.query(
    `SELECT id, nombre, ciudad, estrellas, precio_noche, ${hotelPuntuacion}, ${hotelImagen}, ${hotelDisponible}
     FROM hoteles ${hotelWhere} ${hotelOrder} LIMIT 40`,
    hotelParams
  );

  // Respaldo en memoria para búsquedas con acentos (Cancún/Cancun, Río/Rio).
  const vuelosFiltrados = opciones.usarDestino || opciones.usarOrigen
    ? vuelos.filter(v => (!opciones.usarOrigen || contiene(v.origen, filtros.origen)) && (!opciones.usarDestino || contiene(v.destino, filtros.destino)))
    : vuelos;
  const hotelesFiltrados = opciones.usarDestino
    ? hoteles.filter(h => contiene(h.ciudad, filtros.destino))
    : hoteles;

  return { vuelos: vuelosFiltrados, hoteles: hotelesFiltrados };
}

function calcularNoches(ida, vuelta) {
  if (!ida || !vuelta) return 3;
  const a = new Date(ida);
  const b = new Date(vuelta);
  const diff = Math.round((b - a) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 1;
}

module.exports = router;
