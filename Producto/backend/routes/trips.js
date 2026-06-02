const express = require('express');
const pool = require('../db');
const authRequired = require('../middleware/auth');

const router = express.Router();

router.get('/', authRequired, async (req, res) => {
  const [rows] = await pool.query(`
    SELECT vg.id, vg.fecha_guardado, v.aerolinea, v.origen, v.destino, v.fecha_salida, v.fecha_regreso,
           v.precio AS precio_vuelo, h.nombre AS hotel, h.ciudad, h.precio_noche, h.puntuacion
    FROM viajes_guardados vg
    JOIN vuelos v ON v.id = vg.vuelo_id
    JOIN hoteles h ON h.id = vg.hotel_id
    WHERE vg.usuario_id = ?
    ORDER BY vg.fecha_guardado DESC
  `, [req.user.id]);
  res.json({ ok: true, viajes: rows });
});

router.post('/', authRequired, async (req, res) => {
  const { vuelo_id, hotel_id } = req.body;
  if (!vuelo_id || !hotel_id) return res.status(400).json({ ok: false, message: 'Selecciona vuelo y alojamiento.' });
  const [result] = await pool.query(
    'INSERT INTO viajes_guardados (usuario_id, vuelo_id, hotel_id) VALUES (?, ?, ?)',
    [req.user.id, vuelo_id, hotel_id]
  );
  res.json({ ok: true, id: result.insertId, message: 'Viaje guardado en tu cuenta.' });
});

router.delete('/:id', authRequired, async (req, res) => {
  await pool.query('DELETE FROM viajes_guardados WHERE id = ? AND usuario_id = ?', [req.params.id, req.user.id]);
  res.json({ ok: true, message: 'Viaje eliminado.' });
});

module.exports = router;
