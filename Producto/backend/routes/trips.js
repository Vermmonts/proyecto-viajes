const express = require('express');
const pool = require('../db');
const authRequired = require('../middleware/auth');

const router = express.Router();
const estadosPermitidos = ['planificado', 'reservado', 'pagado', 'realizado', 'cancelado', 'pendiente', 'confirmado'];
const cache = { vuelos: null, hoteles: null, viajes_guardados: null };

async function getColumns(table) {
  if (cache[table]) return cache[table];
  const [cols] = await pool.query(`SHOW COLUMNS FROM ${table}`);
  cache[table] = new Set(cols.map(c => c.Field));
  return cache[table];
}

function limpiarEstado(estado) {
  const valor = String(estado || 'planificado').toLowerCase().trim();
  if (valor === 'pendiente') return 'planificado';
  if (valor === 'confirmado') return 'reservado';
  return estadosPermitidos.includes(valor) ? valor : 'planificado';
}

function limpiarNotas(notas) {
  return String(notas || '').trim().slice(0, 500);
}

async function buildSelectViajes() {
  const h = await getColumns('hoteles');
  const v = await getColumns('vuelos');
  const vg = await getColumns('viajes_guardados');

  const hotelPuntuacion = h.has('puntuacion') ? 'h.puntuacion' : (h.has('valoracion') ? 'h.valoracion' : '4.0');
  const hotelImagen = h.has('imagen') ? 'h.imagen' : 'NULL';
  const horaSalida = v.has('hora_salida') ? 'v.hora_salida' : 'NULL';
  const horaRegreso = v.has('hora_regreso') ? 'v.hora_regreso' : 'NULL';
  const fechaGuardado = vg.has('fecha_guardado') ? 'vg.fecha_guardado' : (vg.has('creado_en') ? 'vg.creado_en' : 'NULL');
  const fechaActualizacion = vg.has('fecha_actualizacion') ? 'vg.fecha_actualizacion' : (vg.has('actualizado_en') ? 'vg.actualizado_en' : 'NULL');
  const estado = vg.has('estado') ? 'vg.estado' : "'planificado'";
  const notas = vg.has('notas') ? 'vg.notas' : 'NULL';

  return `
    SELECT vg.id, ${fechaGuardado} AS fecha_guardado, ${fechaActualizacion} AS fecha_actualizacion,
           vg.vuelo_id, vg.hotel_id, ${estado} AS estado, ${notas} AS notas,
           v.aerolinea, v.origen, v.destino, v.fecha_salida, v.fecha_regreso,
           ${horaSalida} AS hora_salida, ${horaRegreso} AS hora_regreso, v.precio AS precio_vuelo,
           h.nombre AS hotel, h.ciudad, h.precio_noche, ${hotelPuntuacion} AS puntuacion,
           h.estrellas, ${hotelImagen} AS imagen
    FROM viajes_guardados vg
    JOIN vuelos v ON v.id = vg.vuelo_id
    JOIN hoteles h ON h.id = vg.hotel_id
    WHERE vg.usuario_id = ?
  `;
}

async function validarVueloHotel(vuelo_id, hotel_id) {
  const v = await getColumns('vuelos');
  const h = await getColumns('hoteles');
  const vueloWhere = v.has('disponible') ? 'id = ? AND disponible = 1' : 'id = ?';
  const hotelWhere = h.has('disponible') ? 'id = ? AND disponible = 1' : 'id = ?';
  const [[vuelo]] = await pool.query(`SELECT id FROM vuelos WHERE ${vueloWhere}`, [vuelo_id]);
  const [[hotel]] = await pool.query(`SELECT id FROM hoteles WHERE ${hotelWhere}`, [hotel_id]);
  return Boolean(vuelo && hotel);
}

async function insertViaje(usuarioId, vueloId, hotelId, estado, notas) {
  const vg = await getColumns('viajes_guardados');
  const cols = ['usuario_id', 'vuelo_id', 'hotel_id'];
  const vals = [usuarioId, vueloId, hotelId];
  if (vg.has('estado')) { cols.push('estado'); vals.push(estado); }
  if (vg.has('notas')) { cols.push('notas'); vals.push(notas); }
  const marks = cols.map(() => '?').join(', ');
  return pool.query(`INSERT INTO viajes_guardados (${cols.join(', ')}) VALUES (${marks})`, vals);
}

router.get('/', authRequired, async (req, res) => {
  try {
    const selectViajes = await buildSelectViajes();
    const [rows] = await pool.query(`${selectViajes} ORDER BY fecha_guardado DESC`, [req.user.id]);
    res.json({ ok: true, viajes: rows });
  } catch (error) {
    console.error('ERROR LISTAR VIAJES:', error);
    res.status(500).json({ ok: false, message: `No se pudieron cargar tus viajes guardados: ${error.message}` });
  }
});

router.get('/:id', authRequired, async (req, res) => {
  try {
    const selectViajes = await buildSelectViajes();
    const [rows] = await pool.query(`${selectViajes} AND vg.id = ? LIMIT 1`, [req.user.id, req.params.id]);
    if (!rows.length) return res.status(404).json({ ok: false, message: 'Viaje no encontrado.' });
    res.json({ ok: true, viaje: rows[0] });
  } catch (error) {
    console.error('ERROR VER VIAJE:', error);
    res.status(500).json({ ok: false, message: `No se pudo cargar el viaje: ${error.message}` });
  }
});

router.post('/', authRequired, async (req, res) => {
  try {
    const vuelo_id = Number(req.body.vuelo_id);
    const hotel_id = Number(req.body.hotel_id);
    const estado = limpiarEstado(req.body.estado);
    const notas = limpiarNotas(req.body.notas);

    if (!vuelo_id || !hotel_id) return res.status(400).json({ ok: false, message: 'Selecciona vuelo y alojamiento.' });

    const existe = await validarVueloHotel(vuelo_id, hotel_id);
    if (!existe) return res.status(404).json({ ok: false, message: 'El vuelo o el hotel ya no está disponible.' });

    const [duplicado] = await pool.query('SELECT id FROM viajes_guardados WHERE usuario_id = ? AND vuelo_id = ? AND hotel_id = ? LIMIT 1', [req.user.id, vuelo_id, hotel_id]);
    if (duplicado.length) return res.json({ ok: true, id: duplicado[0].id, message: 'Este viaje ya estaba guardado en tu cuenta.' });

    const [result] = await insertViaje(req.user.id, vuelo_id, hotel_id, estado, notas);
    res.status(201).json({ ok: true, id: result.insertId, message: 'Viaje guardado en tu cuenta.' });
  } catch (error) {
    console.error('ERROR CREAR VIAJE:', error);
    res.status(500).json({ ok: false, message: `No se pudo guardar el viaje: ${error.message}` });
  }
});

router.put('/:id', authRequired, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM viajes_guardados WHERE id = ? AND usuario_id = ? LIMIT 1', [req.params.id, req.user.id]);
    const actual = rows[0];
    if (!actual) return res.status(404).json({ ok: false, message: 'Viaje no encontrado.' });

    const vuelo_id = Number(req.body.vuelo_id || actual.vuelo_id);
    const hotel_id = Number(req.body.hotel_id || actual.hotel_id);
    const estado = limpiarEstado(req.body.estado || actual.estado);
    const notas = limpiarNotas(Object.prototype.hasOwnProperty.call(req.body, 'notas') ? req.body.notas : actual.notas);

    const existe = await validarVueloHotel(vuelo_id, hotel_id);
    if (!existe) return res.status(404).json({ ok: false, message: 'El vuelo o el hotel ya no está disponible.' });

    const vg = await getColumns('viajes_guardados');
    const sets = ['vuelo_id = ?', 'hotel_id = ?'];
    const vals = [vuelo_id, hotel_id];
    if (vg.has('estado')) { sets.push('estado = ?'); vals.push(estado); }
    if (vg.has('notas')) { sets.push('notas = ?'); vals.push(notas); }
    vals.push(req.params.id, req.user.id);
    await pool.query(`UPDATE viajes_guardados SET ${sets.join(', ')} WHERE id = ? AND usuario_id = ?`, vals);

    res.json({ ok: true, message: 'Viaje actualizado.' });
  } catch (error) {
    console.error('ERROR ACTUALIZAR VIAJE:', error);
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ ok: false, message: 'Ya tienes guardado ese viaje.' });
    res.status(500).json({ ok: false, message: `No se pudo actualizar el viaje: ${error.message}` });
  }
});

router.delete('/:id', authRequired, async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM viajes_guardados WHERE id = ? AND usuario_id = ?', [req.params.id, req.user.id]);
    if (!result.affectedRows) return res.status(404).json({ ok: false, message: 'Viaje no encontrado.' });
    res.json({ ok: true, message: 'Viaje eliminado.' });
  } catch (error) {
    console.error('ERROR ELIMINAR VIAJE:', error);
    res.status(500).json({ ok: false, message: `No se pudo eliminar el viaje: ${error.message}` });
  }
});

module.exports = router;
