const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const authRequired = require('../middleware/auth');

const router = express.Router();

const EMAIL_MAX_LENGTH = 150;
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 100;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72; // bcrypt solo considera de forma segura los primeros 72 bytes.

function signUser(user) {
  return jwt.sign(
    { id: user.id, nombre: user.nombre, email: user.email },
    process.env.JWT_SECRET || 'dev_secret',
    { expiresIn: '7d' }
  );
}

function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(email) {
  if (!email || email.length > EMAIL_MAX_LENGTH || /\s/.test(email)) return false;

  const parts = email.split('@');
  if (parts.length !== 2) return false;

  const [local, domain] = parts;
  if (!local || !domain || local.length > 64 || domain.length > 253) return false;
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return false;

  const labels = domain.split('.');
  if (labels.length < 2) return false;
  return labels.every(label => (
    label.length >= 1 &&
    label.length <= 63 &&
    !label.startsWith('-') &&
    !label.endsWith('-') &&
    /^[A-Za-z0-9-]+$/.test(label)
  ));
}

function validateName(nombre) {
  if (!nombre) return 'El nombre es obligatorio.';
  if (nombre.length < NAME_MIN_LENGTH) return `El nombre debe tener al menos ${NAME_MIN_LENGTH} caracteres.`;
  if (nombre.length > NAME_MAX_LENGTH) return `El nombre no puede superar los ${NAME_MAX_LENGTH} caracteres.`;
  if (!/^[\p{L}\p{M}.'’\- ]+$/u.test(nombre)) {
    return 'El nombre solo puede contener letras, espacios, puntos, apóstrofes y guiones.';
  }
  return null;
}

function validatePassword(password, { nombre = '', email = '' } = {}) {
  if (!password) return 'La contraseña es obligatoria.';
  if (password.length < PASSWORD_MIN_LENGTH) return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `La contraseña no puede superar los ${PASSWORD_MAX_LENGTH} caracteres.`;
  if (/\s/.test(password)) return 'La contraseña no puede contener espacios.';
  if (!/[a-záéíóúüñ]/.test(password)) return 'La contraseña debe incluir al menos una letra minúscula.';
  if (!/[A-ZÁÉÍÓÚÜÑ]/.test(password)) return 'La contraseña debe incluir al menos una letra mayúscula.';
  if (!/\d/.test(password)) return 'La contraseña debe incluir al menos un número.';
  if (!/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]/.test(password)) return 'La contraseña debe incluir al menos un símbolo.';

  const lowerPassword = password.toLowerCase();
  const emailUser = email.split('@')[0];
  const compactName = nombre.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

  if (emailUser.length >= 4 && lowerPassword.includes(emailUser.toLowerCase())) {
    return 'La contraseña no debe contener la parte principal del correo.';
  }
  if (compactName.length >= 4 && lowerPassword.includes(compactName)) {
    return 'La contraseña no debe contener tu nombre completo.';
  }
  return null;
}

function validateRegistration(body = {}) {
  const nombre = normalizeName(body.nombre);
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const confirmPassword = body.confirmPassword === undefined
    ? undefined
    : String(body.confirmPassword || '');
  const errors = {};

  const nameError = validateName(nombre);
  if (nameError) errors.nombre = nameError;

  if (!email) errors.email = 'El correo electrónico es obligatorio.';
  else if (!isValidEmail(email)) errors.email = 'Ingresa un correo electrónico válido, por ejemplo nombre@dominio.cl.';

  const passwordError = validatePassword(password, { nombre, email });
  if (passwordError) errors.password = passwordError;

  if (confirmPassword !== undefined && password !== confirmPassword) {
    errors.confirmPassword = 'Las contraseñas no coinciden.';
  }

  return { nombre, email, password, errors };
}

async function getUserColumns() {
  const [columns] = await pool.query('SHOW COLUMNS FROM usuarios');
  return new Set(columns.map(c => c.Field));
}

router.post(['/registro', '/register'], async (req, res) => {
  const { nombre, email, password, errors } = validateRegistration(req.body);

  if (Object.keys(errors).length) {
    return res.status(400).json({
      ok: false,
      message: 'Revisa los datos ingresados.',
      errors
    });
  }

  try {
    const [exists] = await pool.query(
      'SELECT id FROM usuarios WHERE LOWER(TRIM(email)) = ? LIMIT 1',
      [email]
    );

    if (exists.length) {
      return res.status(409).json({
        ok: false,
        message: 'Ya existe una cuenta registrada con ese correo.',
        errors: { email: 'Este correo ya está registrado. Inicia sesión o utiliza otro.' }
      });
    }

    const columns = await getUserColumns();
    const hash = await bcrypt.hash(password, 12);
    let result;

    if (columns.has('password_hash') && columns.has('password')) {
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
    return res.status(201).json({
      ok: true,
      user,
      usuario: user,
      token: signUser(user),
      message: 'Usuario registrado correctamente.'
    });
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        ok: false,
        message: 'Ya existe una cuenta registrada con ese correo.',
        errors: { email: 'Este correo ya está registrado. Inicia sesión o utiliza otro.' }
      });
    }

    console.error('ERROR REGISTRO:', error);
    return res.status(500).json({
      ok: false,
      message: 'No se pudo crear la cuenta. Inténtalo nuevamente.'
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    const errors = {};

    if (!email) errors.email = 'Ingresa tu correo electrónico.';
    else if (!isValidEmail(email)) errors.email = 'Ingresa un correo electrónico válido.';
    if (!password) errors.password = 'Ingresa tu contraseña.';

    if (Object.keys(errors).length) {
      return res.status(400).json({ ok: false, message: 'Revisa los datos ingresados.', errors });
    }

    const [rows] = await pool.query(
      'SELECT * FROM usuarios WHERE LOWER(TRIM(email)) = ? ORDER BY id ASC LIMIT 1',
      [email]
    );
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ ok: false, message: 'Correo o contraseña incorrectos.' });
    }

    let valid = false;
    const hash = user.password_hash || user.password;

    if (hash && String(hash).startsWith('$2')) {
      valid = await bcrypt.compare(password, hash);
    } else if (user.password) {
      // Compatibilidad temporal con usuarios antiguos creados manualmente en SQL.
      valid = password === user.password;
      if (valid && Object.prototype.hasOwnProperty.call(user, 'password_hash')) {
        const nuevoHash = await bcrypt.hash(password, 12);
        await pool.query('UPDATE usuarios SET password_hash = ?, password = NULL, email = ? WHERE id = ?', [nuevoHash, email, user.id]);
      }
    }

    if (!valid) {
      return res.status(401).json({ ok: false, message: 'Correo o contraseña incorrectos.' });
    }

    if (user.email !== email) {
      await pool.query('UPDATE usuarios SET email = ? WHERE id = ?', [email, user.id]).catch(() => {});
    }

    const safeUser = { id: user.id, nombre: user.nombre, email };
    return res.json({
      ok: true,
      user: safeUser,
      usuario: safeUser,
      token: signUser(safeUser),
      message: 'Inicio de sesión correcto.'
    });
  } catch (error) {
    console.error('ERROR LOGIN:', error);
    return res.status(500).json({ ok: false, message: 'No se pudo iniciar sesión. Inténtalo nuevamente.' });
  }
});

router.get('/perfil', authRequired, (req, res) => {
  res.json({ ok: true, user: req.user, usuario: req.user });
});

module.exports = router;
