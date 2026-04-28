const db = require("../db");

async function buscarVuelos(origen, destino) {

  const [rows] = await db.execute(

    `
      SELECT *
      FROM vuelos
      WHERE origen = ?
      AND destino = ?
      ORDER BY precio ASC
    `,

    [origen, destino]

  );

  return rows;
}

module.exports = buscarVuelos;