require("dotenv").config();

const express = require("express");
const cors = require("cors");

const buscarVuelos =
  require("./services/vuelos");

const buscarHoteles =
  require("./services/hoteles");

const app = express();

app.use(cors());
app.use(express.json());

// =====================================
// BUSQUEDA
// =====================================

app.get("/buscar", async (req, res) => {

  try {

    const {
      origen,
      destino,
      presupuesto,
      prioridad
    } = req.query;

    // =====================================
    // VALIDACIONES
    // =====================================

    if (!destino || destino.trim() === "") {

      return res.json({
        error:
          "Debe ingresar un destino"
      });
    }

    // =====================================
    // MENSAJES
    // =====================================

    let mensaje = null;

    if (
      presupuesto &&
      Number(presupuesto) < 150000
    ) {

      mensaje =
        "⚠️ El presupuesto ingresado es muy bajo para viajes internacionales.";
    }

    // =====================================
    // BUSQUEDA
    // =====================================

    const vuelos =
      await buscarVuelos(
        origen,
        destino
      );

    const hoteles =
      await buscarHoteles(
        destino
      );

    // =====================================
    // SIN RESULTADOS
    // =====================================

    if (
      vuelos.length === 0 &&
      hoteles.length === 0
    ) {

      return res.json({
        mensaje:
          "No se encontraron resultados."
      });
    }

    // =====================================
    // VUELO MÁS BARATO
    // =====================================

    let vueloMasBarato = null;

    if (vuelos.length > 0) {

      vueloMasBarato =
        vuelos.reduce((min, v) =>
          v.precio < min.precio ? v : min
        );
    }

    // =====================================
    // HOTEL MÁS BARATO
    // =====================================

    let hotelMasBarato = null;

    if (hoteles.length > 0) {

      hotelMasBarato =
        hoteles.reduce((min, h) =>
          h.precio < min.precio ? h : min
        );
    }

    // =====================================
    // COMBO ECONOMICO
    // =====================================

    let economico = null;

    if (
      vueloMasBarato &&
      hotelMasBarato
    ) {

      economico = {

        vuelo:
          vueloMasBarato,

        hotel:
          hotelMasBarato,

        total:
          vueloMasBarato.precio +
          hotelMasBarato.precio
      };
    }

    // =====================================
    // RECOMENDACION
    // =====================================

    let mejor = economico;

    if (
      prioridad === "rating" &&
      hoteles.length > 0 &&
      vuelos.length > 0
    ) {

      const mejorHotel =
        hoteles.reduce((max, h) =>
          h.rating > max.rating ? h : max
        );

      mejor = {

        ida: vuelos[0],

        hotel: mejorHotel,

        total:
          vuelos[0].precio +
          mejorHotel.precio
      };
    }

    // =====================================

    res.json({

      mensaje,

      vuelosIda: vuelos,

      hoteles,

      vueloMasBarato,

      hotelMasBarato,

      economico,

      mejor

    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error:
        "Error en servidor"
    });
  }
});

// =====================================

const PORT = 3000;

app.listen(PORT, () => {

  console.log(
    `Servidor corriendo en puerto ${PORT}`
  );
});