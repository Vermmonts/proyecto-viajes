const express = require('express');
const pool = require('../db');
const authRequired = require('../middleware/auth');

const router = express.Router();
const estadosPermitidos = ['planificado', 'reservado', 'pagado', 'realizado', 'cancelado'];

function limpiarEstado(estado) {
  const valor = String(estado || 'planificado').toLowerCase().trim();
  return estadosPermitidos.includes(valor) ? valor : 'planificado';
}
function limpiarNotas(notas) { return String(notas || '').trim().slice(0, 500); }
function texto(valor, max = 255) { return String(valor || '').trim().slice(0, max) || null; }
function numero(valor) { const n = Number(valor); return Number.isFinite(n) ? n : null; }

router.get('/', authRequired, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, titulo, origen, destino, aeropuerto_llegada, fechas, personas,
              proveedor_vuelo AS aerolinea, alojamiento AS hotel,
              total_estimado, moneda, url_reserva, estado, notas,
              fecha_guardado, fecha_actualizacion, 'web' AS tipo_origen
       FROM viajes_web_guardados
       WHERE usuario_id = ?
       ORDER BY fecha_guardado DESC`,
      [req.user.id]
    );
    res.json({ ok: true, viajes: rows });
  } catch (error) {
    console.error('ERROR LISTAR VIAJES WEB:', error);
    res.status(500).json({ ok: false, message: `No se pudieron cargar tus viajes guardados: ${error.message}` });
  }
});

router.get('/:id', authRequired, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM viajes_web_guardados WHERE id = ? AND usuario_id = ? LIMIT 1',
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ ok: false, message: 'Viaje no encontrado.' });
    res.json({ ok: true, viaje: rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, message: `No se pudo cargar el viaje: ${error.message}` });
  }
});

router.post('/', authRequired, async (req, res) => {
  try {
    const opcion = req.body.opcion_web;
    if (!opcion || typeof opcion !== 'object') {
      return res.status(400).json({ ok: false, message: 'Debes seleccionar una opción encontrada en internet.' });
    }

    const vuelo = opcion.vuelo || {};
    const alojamiento = opcion.alojamiento || {};
    const url = texto(opcion.url_reserva || vuelo.url || alojamiento.url, 2000);

    const [result] = await pool.query(
      `INSERT INTO viajes_web_guardados
       (usuario_id, titulo, origen, destino, aeropuerto_llegada, fechas, personas,
        proveedor_vuelo, alojamiento, total_estimado, moneda,
        url_reserva, fuente_json, estado, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        texto(opcion.titulo || 'Mejor opción encontrada en internet') || 'Mejor opción encontrada en internet',
        texto(opcion.origen, 120),
        texto(opcion.destino_final, 120),
        texto(opcion.aeropuerto_llegada, 180),
        texto(opcion.fechas, 180),
        Math.max(1, Number(opcion.personas || 1)),
        texto(vuelo.proveedor, 180),
        texto(alojamiento.nombre, 255),
        numero(opcion.total_estimado),
        texto(opcion.moneda || vuelo.moneda || 'CLP', 10) || 'CLP',
        url,
        JSON.stringify(opcion),
        limpiarEstado(req.body.estado),
        limpiarNotas(req.body.notas)
      ]
    );

    res.status(201).json({ ok: true, id: result.insertId, message: 'Opción web guardada en tu cuenta.' });
  } catch (error) {
    console.error('ERROR GUARDAR VIAJE WEB:', error);
    res.status(500).json({ ok: false, message: `No se pudo guardar el viaje: ${error.message}` });
  }
});

router.put('/:id', authRequired, async (req, res) => {
  try {
    const estado = limpiarEstado(req.body.estado);
    const notas = limpiarNotas(req.body.notas);
    const [result] = await pool.query(
      `UPDATE viajes_web_guardados
       SET estado = ?, notas = ?
       WHERE id = ? AND usuario_id = ?`,
      [estado, notas, req.params.id, req.user.id]
    );
    if (!result.affectedRows) return res.status(404).json({ ok: false, message: 'Viaje no encontrado.' });
    res.json({ ok: true, message: 'Viaje actualizado.' });
  } catch (error) {
    res.status(500).json({ ok: false, message: `No se pudo actualizar el viaje: ${error.message}` });
  }
});

router.delete('/:id', authRequired, async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM viajes_web_guardados WHERE id = ? AND usuario_id = ?',
      [req.params.id, req.user.id]
    );
    if (!result.affectedRows) return res.status(404).json({ ok: false, message: 'Viaje no encontrado.' });
    res.json({ ok: true, message: 'Viaje eliminado.' });
  } catch (error) {
    res.status(500).json({ ok: false, message: `No se pudo eliminar el viaje: ${error.message}` });
  }
});

module.exports = router;
