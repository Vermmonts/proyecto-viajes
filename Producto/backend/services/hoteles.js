const axios = require("axios");

async function buscarHoteles(ciudad) {
  try {
    const response = await axios.get("https://api.ejemplo.com/hoteles", {
      params: {
        city: ciudad
      },
      headers: {
        Authorization: `Bearer ${process.env.API_HOTELES}`
      }
    });

    // Normalización de datos
    const hoteles = response.data.map(h => ({
      tipo: "hotel",
      nombre: h.name || "Sin nombre",
      precio: h.price || 0,
      rating: h.rating || 0
    }));

    return hoteles;

  } catch (error) {
    console.error("❌ Error al buscar hoteles:", error.message);
    return [];
  }
}

module.exports = buscarHoteles;