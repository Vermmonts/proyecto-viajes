const axios = require("axios");

async function buscarHoteles(destino) {

  try {

    // =====================================
    // BUSCAR DESTINO
    // =====================================

    const destinoResponse = await axios.get(

      "https://booking-com15.p.rapidapi.com/api/v1/hotels/searchDestination",

      {

        params: {
          query: destino
        },

        headers: {

          "x-rapidapi-key":
            process.env.RAPIDAPI_KEY,

          "x-rapidapi-host":
            "booking-com15.p.rapidapi.com"

        }

      }

    );

    console.log(
      "DESTINO:",
      JSON.stringify(destinoResponse.data, null, 2)
    );

    // =====================================

    if (
      !destinoResponse.data.data ||
      destinoResponse.data.data.length === 0
    ) {

      return [];
    }

    // =====================================

    const destinoId =
      destinoResponse.data.data[0].dest_id;

    // =====================================
    // BUSCAR HOTELES
    // =====================================

    const hotelesResponse = await axios.get(

      "https://booking-com15.p.rapidapi.com/api/v1/hotels/searchHotels",

      {

        params: {

          dest_id:
            destinoId,

          search_type:
            "CITY",

          arrival_date:
            "2026-06-10",

          departure_date:
            "2026-06-15",

          adults:
            "1",

          room_qty:
            "1",

          page_number:
            "1",

          units:
            "metric",

          languagecode:
            "es",

          currency_code:
            "CLP"

        },

        headers: {

          "x-rapidapi-key":
            process.env.RAPIDAPI_KEY,

          "x-rapidapi-host":
            "booking-com15.p.rapidapi.com"

        }

      }

    );

    console.log(
      "HOTELES:",
      JSON.stringify(hotelesResponse.data, null, 2)
    );

    // =====================================
    // VALIDAR ESTRUCTURA
    // =====================================

    const hotelesData =
      hotelesResponse.data?.data?.hotels ||
      hotelesResponse.data?.data ||
      [];

    // =====================================

    if (
      !Array.isArray(hotelesData)
    ) {

      return [];
    }

    // =====================================

    return hotelesData.map(h => ({

      nombre:
        h.property?.name ||
        "Hotel sin nombre",

      ciudad:
        destino,

      precio:
        parseInt(
          h.property?.priceBreakdown
            ?.grossPrice
            ?.value || 0
        ),

      rating:
        h.property?.reviewScore || 0

    }));

  } catch (error) {

    console.error(
      "ERROR HOTELES:"
    );

    console.error(error.response?.data || error.message);

    return [];
  }
}

module.exports = buscarHoteles;