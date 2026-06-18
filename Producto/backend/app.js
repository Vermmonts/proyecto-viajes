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
    const [[usuarios]] = await pool.query('SELECT COUNT(*) AS total FROM usuarios');
    const [[fuentes]] = await pool.query('SELECT COUNT(*) AS total FROM fuentes_web');
    const [[resultados]] = await pool.query('SELECT COUNT(*) AS total FROM resultados_web_viajes');
    const [[viajes]] = await pool.query('SELECT COUNT(*) AS total FROM viajes_web_guardados');
    res.json({
      ok: true, db: process.env.DB_NAME, port: process.env.DB_PORT || 3307,
      usuarios: usuarios.total, fuentes_web: fuentes.total, resultados_web: resultados.total, viajes_guardados: viajes.total,
      nota: 'MySQL se usa solo para almacenamiento; la búsqueda se realiza con Tavily y Ollama.'
    });
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

app.get('/api/debug/ia', async (req, res) => {
  const { aiEstaConfigurada } = require('./services/searchParser');
  const tavily = process.env.TAVILY_API_KEY || '';
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const modelo = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
  let ollamaDisponible = false;
  let detalleOllama = '';
  try {
    const response = await fetch(`${ollamaUrl.replace(/\/$/, '')}/api/tags`);
    ollamaDisponible = response.ok;
    if (!response.ok) detalleOllama = `HTTP ${response.status}`;
  } catch (error) {
    detalleOllama = error.message;
  }
  res.json({
    ok: true,
    ia_configurada: aiEstaConfigurada(),
    proveedor: 'Tavily + Ollama',
    modelo,
    ollama_url: ollamaUrl,
    ollama_disponible: ollamaDisponible,
    detalle_ollama: detalleOllama || null,
    tavily_key_detectada: tavily ? `${tavily.slice(0, 5)}...${tavily.slice(-4)}` : null,
    nota: aiEstaConfigurada()
      ? 'Configuración detectada. Ollama debe estar ejecutándose y el modelo descargado.'
      : 'Configura TAVILY_API_KEY, OLLAMA_URL y OLLAMA_MODEL en .env.'
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
