const axios = require("axios");

async function buscarVuelos(origen, destino) {
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

    // Normalización de datos
    const vuelos = response.data.map(v => ({
      tipo: "vuelo",
      precio: v.price || 0,
      duracion: v.duration || "N/A",
      aerolinea: v.airline || "Desconocida"
    }));

    return vuelos;

  } catch (error) {
    console.error("❌ Error al buscar vuelos:", error.message);
    return [];
  }
}

module.exports = buscarVuelos;