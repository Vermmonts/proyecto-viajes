require("dotenv").config();

const express = require("express");
const cors = require("cors");

const buscarVuelos = require("./services/vuelos");
const buscarHoteles = require("./services/hoteles");

const app = express();

app.use(cors());
app.use(express.json());

// =====================================
// RUTA PRINCIPAL
// =====================================

app.get("/", (req, res) => {

  res.json({
    mensaje: "Servidor funcionando"
  });

});

// =====================================
// BUSQUEDA
// =====================================

app.get("/buscar", async (req, res) => {

  try {

    const { origen, destino, presupuesto } = req.query;

    if (!origen || !destino) {

      return res.status(400).json({
        error: "Debe ingresar origen y destino"
      });

    }

    const vuelos = await buscarVuelos(origen, destino);

    const hoteles = await buscarHoteles(destino);

    let vuelosFiltrados = vuelos;
    let hotelesFiltrados = hoteles;

    if (presupuesto) {

      vuelosFiltrados = vuelos.filter(
        v => v.precio <= Number(presupuesto)
      );

      hotelesFiltrados = hoteles.filter(
        h => h.precio <= Number(presupuesto)
      );

    }

    const mejorVuelo = vuelosFiltrados[0] || null;

    const mejorHotel = hotelesFiltrados[0] || null;

    res.json({

      recomendacion: {

        vuelo: mejorVuelo,
        hotel: mejorHotel,

        total:
          mejorVuelo && mejorHotel
            ? mejorVuelo.precio + mejorHotel.precio
            : null
      },

      vuelos: vuelosFiltrados,
      hoteles: hotelesFiltrados

    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Error del servidor"
    });

  }

});

// =====================================
// SERVIDOR
// =====================================

const PORT = 3000;

app.listen(PORT, () => {

  console.log(`Servidor corriendo en http://localhost:${PORT}`);

});