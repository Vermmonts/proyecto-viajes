const axios = require("axios");

async function buscarHoteles(ciudad) {

  if (process.env.USE_API !== "true") {
    return [
      {
        tipo: "hotel",
        nombre: "Hotel Central",
        precio: 50000,
        rating: 4.5
      },
      {
        tipo: "hotel",
        nombre: "Hotel Sur",
        precio: 40000,
        rating: 4.2
      }
    ];
  }

  try {
    const response = await axios.get("https://api.ejemplo.com/hoteles", {
      params: {
        city: ciudad
      },
      headers: {
        Authorization: `Bearer ${process.env.API_HOTELES}`
      }
    });

    return response.data.map(h => ({
      tipo: "hotel",
      nombre: h.name || "Sin nombre",
      precio: h.price || 0,
      rating: h.rating || 0
    }));

  } catch (error) {
    console.error("❌ Error API hoteles:", error.message);
    return [];
  }
}

module.exports = buscarHoteles;