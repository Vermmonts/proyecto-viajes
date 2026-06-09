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

async function getUserColumns() {
  const [columns] = await pool.query('SHOW COLUMNS FROM usuarios');
  return new Set(columns.map(c => c.Field));
}

router.post(['/registro', '/register'], async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    if (!nombre || !email || !password) {
      return res.status(400).json({ ok: false, message: 'Completa nombre, correo y contraseña.' });
    }

    const [exists] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (exists.length) {
      return res.status(409).json({ ok: false, message: 'Ese correo ya está registrado.' });
    }

    const columns = await getUserColumns();
    const hash = await bcrypt.hash(password, 10);
    let result;

    if (columns.has('password_hash') && columns.has('password')) {
      // Guardamos el hash en ambas columnas para ser compatible con bases antiguas
      // donde password puede seguir siendo NOT NULL.
      [result] = await pool.query(
        'INSERT INTO usuarios (nombre, email, password_hash, password) VALUES (?, ?, ?, ?)',
        [nombre, email, hash, hash]
      );
    } else if (columns.has('password_hash')) {
      [result] = await pool.query(
        'INSERT INTO usuarios (nombre, email, password_hash) VALUES (?, ?, ?)',
        [nombre, email, hash]
      );
    } else {
      [result] = await pool.query(
        'INSERT INTO usuarios (nombre, email, password) VALUES (?, ?, ?)',
        [nombre, email, hash]
      );
    }

    const user = { id: result.insertId, nombre, email };
    res.json({ ok: true, user, usuario: user, token: signUser(user), message: 'Usuario registrado correctamente.' });
  } catch (error) {
    console.error('ERROR REGISTRO:', error);
    res.status(500).json({ ok: false, message: `No se pudo registrar el usuario: ${error.message}` });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ ok: false, message: 'Ingresa correo y contraseña.' });
    }

    const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ ok: false, message: 'Credenciales incorrectas.' });

    let valid = false;
    const hash = user.password_hash || user.password;

    if (hash && String(hash).startsWith('$2')) {
      valid = await bcrypt.compare(password, hash);
    } else if (user.password) {
      // Compatibilidad con usuarios creados manualmente en SQL con password en texto simple.
      valid = password === user.password;
      if (valid && Object.prototype.hasOwnProperty.call(user, 'password_hash')) {
        const nuevoHash = await bcrypt.hash(password, 10);
        await pool.query('UPDATE usuarios SET password_hash = ?, password = NULL WHERE id = ?', [nuevoHash, user.id]);
      }
    }

    if (!valid) return res.status(401).json({ ok: false, message: 'Credenciales incorrectas.' });

    const safeUser = { id: user.id, nombre: user.nombre, email: user.email };
    res.json({ ok: true, user: safeUser, usuario: safeUser, token: signUser(safeUser), message: 'Inicio de sesión correcto.' });
  } catch (error) {
    console.error('ERROR LOGIN:', error);
    res.status(500).json({ ok: false, message: `No se pudo iniciar sesión: ${error.message}` });
  }
});

router.get('/perfil', authRequired, (req, res) => {
  res.json({ ok: true, user: req.user, usuario: req.user });
});

module.exports = router;
