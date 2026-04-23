require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const vuelos = [
  { precio: 120000, duracion: "3h" },
  { precio: 90000, duracion: "1h 30m" }
];

const hoteles = [
  { nombre: "Hotel Central", precio: 50000, rating: 4.5 },
  { nombre: "Hotel Sur", precio: 40000, rating: 4.2 }
];

// Endpoint
app.get("/buscar", (req, res) => {
  const { origen, destino } = req.query;

  if (!origen || !destino) {
    return res.status(400).json({ error: "Faltan parámetros" });
  }

  res.json({
    vuelos,
    hoteles
  });
});

// Servidor
app.listen(3000, () => {
  console.log("Servidor corriendo en http://localhost:3000");
});