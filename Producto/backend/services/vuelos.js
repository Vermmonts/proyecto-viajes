const axios = require("axios");

async function buscarVuelos(origen, destino) {

  if (process.env.USE_API !== "true") {
    return [
      {
        tipo: "vuelo",
        precio: 120000,
        duracion: "3h",
        aerolinea: "LATAM"
      },
      {
        tipo: "vuelo",
        precio: 90000,
        duracion: "1h 30m",
        aerolinea: "Sky"
      }
    ];
  }

  try {
    const response = await axios.get("https://api.ejemplo.com/vuelos", {
      params: {
        from: origen,
        to: destino
      },
      headers: {
        Authorization: `Bearer ${process.env.API_VUELOS}`
      }
    });

    return response.data.map(v => ({
      tipo: "vuelo",
      precio: v.price || 0,
      duracion: v.duration || "N/A",
      aerolinea: v.airline || "Desconocida"
    }));

  } catch (error) {
    console.error("❌ Error API vuelos:", error.message);
    return [];
  }
}

module.exports = buscarVuelos;