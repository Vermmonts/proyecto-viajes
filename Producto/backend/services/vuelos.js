const axios = require("axios");

async function buscarVuelos(origen, destino) {

  try {

    const response = await axios.get(
      "http://api.aviationstack.com/v1/flights",
      {
        params: {
          access_key:
            process.env.AVIATIONSTACK_KEY,

          limit: 15
        }
      }
    );

    const vuelos =
      response.data.data

      .filter(v =>
        v.airline &&
        v.departure &&
        v.arrival
      )

      .map(v => ({

        aerolinea:
          v.airline.name || "Desconocida",

        origen:
          origen || "Santiago",

        destino,

        duracion:
          `${Math.floor(Math.random() * 10) + 1}h`,

        precio:
          Math.floor(
            Math.random() * 350000
          ) + 70000

      }));

    return vuelos;

  } catch (error) {

    console.error(
      "ERROR VUELOS:"
    );

    console.error(error.message);

    return [];
  }
}

module.exports = buscarVuelos;