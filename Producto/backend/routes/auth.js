const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const authRequired = require('../middleware/auth');

const router = express.Router();

function signUser(user) {
  return jwt.sign(
    { id: user.id, nombre: user.nombre, email: user.email },
    process.env.JWT_SECRET || 'dev_secret',
    { expiresIn: '7d' }
  );
}

router.post('/registro', async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    if (!nombre || !email || !password) {
      return res.status(400).json({ ok: false, message: 'Completa nombre, correo y contraseña.' });
    }

    const [exists] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (exists.length) {
      return res.status(409).json({ ok: false, message: 'Ese correo ya está registrado.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO usuarios (nombre, email, password_hash) VALUES (?, ?, ?)',
      [nombre, email, hash]
    );

    const user = { id: result.insertId, nombre, email };
    res.json({ ok: true, user, token: signUser(user) });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'No se pudo registrar el usuario.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ ok: false, message: 'Credenciales incorrectas.' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ ok: false, message: 'Credenciales incorrectas.' });

    const safeUser = { id: user.id, nombre: user.nombre, email: user.email };
    res.json({ ok: true, user: safeUser, token: signUser(safeUser) });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'No se pudo iniciar sesión.' });
  }
});

router.get('/perfil', authRequired, (req, res) => {
  res.json({ ok: true, user: req.user });
});

module.exports = router;
