const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const searchRoutes = require('./routes/search');
const tripRoutes = require('./routes/trips');
const ensureDatabase = require('./initDatabase');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

app.use('/api/auth', authRoutes);
app.use('/api/buscar', searchRoutes);
app.use('/api/mis-viajes', tripRoutes);

app.get('/api/debug/db', async (req, res) => {
  try {
    const pool = require('./db');
    const [[vuelos]] = await pool.query('SELECT COUNT(*) AS total FROM vuelos');
    const [[hoteles]] = await pool.query('SELECT COUNT(*) AS total FROM hoteles');
    const [muestra] = await pool.query('SELECT origen, destino, fecha_salida, fecha_regreso, precio FROM vuelos ORDER BY id DESC LIMIT 5');
    res.json({ ok: true, db: process.env.DB_NAME, port: process.env.DB_PORT || 3307, vuelos: vuelos.total, hoteles: hoteles.total, muestra });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message, db: process.env.DB_NAME, port: process.env.DB_PORT || 3307 });
  }
});



app.get('/api/debug/schema', async (req, res) => {
  try {
    const pool = require('./db');
    const [usuarios] = await pool.query('SHOW COLUMNS FROM usuarios');
    const [vuelos] = await pool.query('SHOW COLUMNS FROM vuelos');
    const [hoteles] = await pool.query('SHOW COLUMNS FROM hoteles');
    const [viajes] = await pool.query('SHOW COLUMNS FROM viajes_guardados');
    res.json({
      ok: true,
      usuarios: usuarios.map(c => c.Field),
      vuelos: vuelos.map(c => c.Field),
      hoteles: hoteles.map(c => c.Field),
      viajes_guardados: viajes.map(c => c.Field)
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.get('/api/debug/ia', (req, res) => {
  const { aiEstaConfigurada } = require('./services/searchParser');
  const key = process.env.GEMINI_API_KEY || '';
  res.json({
    ok: true,
    ia_configurada: aiEstaConfigurada(),
    proveedor: 'Google Gemini',
    modelo: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    proyecto: process.env.GEMINI_PROJECT_ID || null,
    numero_proyecto: process.env.GEMINI_PROJECT_NUMBER || null,
    key_detectada: key ? `${key.slice(0, 6)}...${key.slice(-4)}` : null,
    nota: aiEstaConfigurada() ? 'GEMINI_API_KEY detectada en .env.' : 'Falta GEMINI_API_KEY en .env.'
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

async function start() {
  try {
    await ensureDatabase();
    app.listen(PORT, () => {
      console.log(`Fly and Lodget disponible en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('No se pudo iniciar la aplicación porque falló la conexión/creación de MySQL:');
    console.error(error.message);
    process.exit(1);
  }
}

start();
