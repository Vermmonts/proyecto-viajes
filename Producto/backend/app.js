const express = require("express");
const cors = require("cors");

const buscarVuelos = require("./services/vuelos");
const buscarHoteles = require("./services/hoteles");

const app = express();

app.use(cors());
app.use(express.json());

// =============================
// FUNCIONES
// =============================

function calcularNoches(ida, vuelta) {
  if (!ida || !vuelta) return 1;

  const f1 = new Date(ida);
  const f2 = new Date(vuelta);

  return Math.max(
    1,
    Math.ceil((f2 - f1) / (1000 * 60 * 60 * 24))
  );
}

function calcularScore({ total, rating, prioridad, presupuesto }) {

  if (prioridad === "precio") return total;
  if (prioridad === "rating") return -rating;

  let score = total;

  if (presupuesto && total > presupuesto) {
    score += (total - presupuesto) * 2;
  }

  score -= rating * 1000;

  return score;
}

function sugerenciaFecha(fechaIda) {

  if (!fechaIda) {
    return "💡 Tip: viajar entre semana suele ser más barato";
  }

  const dia = new Date(fechaIda).getDay();

  if (dia === 5 || dia === 6) {
    return "📅 Viajas en fin de semana: precios más altos";
  }

  if (dia === 2 || dia === 3) {
    return "💰 Excelente elección: mitad de semana más barato";
  }

  return "📊 Prueba mover la fecha para mejores precios";
}

// =============================
// ENDPOINT
// =============================

app.get("/buscar", async (req, res) => {

  try {

    const {
      origen,
      destino,
      fechaIda,
      fechaVuelta,
      presupuesto,
      prioridad = "balance"
    } = req.query;

    // 🚨 VALIDACION DESTINO
    if (!destino) {
      return res.json({
        error: "⚠️ Debes ingresar un destino"
      });
    }

    let vuelosIda = await buscarVuelos(origen, destino, fechaIda || null);

    let vuelosVuelta = [];
    if (fechaVuelta) {
      vuelosVuelta = await buscarVuelos(destino, origen, fechaVuelta);
    }

    let hoteles = await buscarHoteles(destino, fechaIda, fechaVuelta);

    vuelosIda = vuelosIda.slice(0, 20);
    vuelosVuelta = vuelosVuelta.slice(0, 20);
    hoteles = hoteles.slice(0, 20);

    const noches = calcularNoches(fechaIda, fechaVuelta);

    let mejor = null;
    let economico = null;
    let mejorScore = Infinity;
    let totalEconomico = Infinity;

    // =============================
    // MÁS BARATOS INDIVIDUALES
    // =============================

    let vueloMasBarato = null;
    let hotelMasBarato = null;

    if (vuelosIda.length > 0) {
      vueloMasBarato = vuelosIda.reduce((min, v) =>
        v.precio < min.precio ? v : min
      );
    }

    if (hoteles.length > 0) {
      hotelMasBarato = hoteles.reduce((min, h) =>
        h.precio < min.precio ? h : min
      );
    }

    // =============================
    // COMBINACIONES
    // =============================

    for (const ida of vuelosIda) {

      const listaVuelta = vuelosVuelta.length > 0 ? vuelosVuelta : [null];

      for (const vuelta of listaVuelta) {

        for (const hotel of hoteles) {

          const total =
            ida.precio +
            (vuelta ? vuelta.precio : 0) +
            hotel.precio * noches;

          if (total < totalEconomico) {
            totalEconomico = total;
            economico = { ida, vuelta, hotel, total };
          }

          const score = calcularScore({
            total,
            rating: hotel.rating,
            prioridad,
            presupuesto: Number(presupuesto)
          });

          if (score < mejorScore) {
            mejorScore = score;
            mejor = { ida, vuelta, hotel, total };
          }

        }
      }
    }

    // =============================
    // MENSAJES
    // =============================

    let mensaje = null;
    const presupuestoNum = Number(presupuesto);

    if (!vuelosIda.length || !hoteles.length) {
      mensaje = "❌ No hay resultados";
    }

    else if (presupuesto && economico) {

      if (presupuestoNum < economico.total) {
        mensaje = "⚠️ Presupuesto muy bajo";
      }

      else if (presupuestoNum > economico.total * 3) {
        mensaje = "💡 Presupuesto alto: puedes mejorar calidad";
      }

      else {
        mensaje = "✅ Buen presupuesto";
      }

    }

    const mensajeFecha = sugerenciaFecha(fechaIda);

    res.json({
      mejor,
      economico,
      vueloMasBarato,
      hotelMasBarato,
      vuelosIda,
      vuelosVuelta,
      hoteles,
      mensaje,
      mensajeFecha
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Error en servidor"
    });

  }

});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});