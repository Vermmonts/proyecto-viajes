const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const searchRoutes = require('./routes/search');
const tripRoutes = require('./routes/trips');

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
    res.json({ ok: true, db: process.env.DB_NAME, port: process.env.DB_PORT || 3306, vuelos: vuelos.total, hoteles: hoteles.total, muestra });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message, db: process.env.DB_NAME, port: process.env.DB_PORT || 3306 });
  }
});


app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Fly and Lodget disponible en http://localhost:${PORT}`);
});
