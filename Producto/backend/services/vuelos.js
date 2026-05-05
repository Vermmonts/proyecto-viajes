const db = require("../db");

async function buscarVuelos(origen, destino, fecha) {

  let query = "SELECT * FROM vuelos WHERE 1=1";
  const params = [];

  if (origen) {
    query += " AND LOWER(origen) LIKE LOWER(?)";
    params.push(`%${origen}%`);
  }

  if (destino) {
    query += " AND LOWER(destino) LIKE LOWER(?)";
    params.push(`%${destino}%`);
  }

  if (fecha) {
    query += " AND fecha = ?";
    params.push(fecha);
  }

  const [rows] = await db.query(query, params);

  console.log("✈️ Vuelos encontrados:", rows.length);

  return rows;
}

module.exports = buscarVuelos;