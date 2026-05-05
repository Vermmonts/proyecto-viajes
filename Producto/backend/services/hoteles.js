const db = require("../db");

async function buscarHoteles(destino, fechaIda, fechaVuelta) {

  let query = "SELECT * FROM hoteles WHERE 1=1";
  const params = [];

  if (destino) {
    query += " AND LOWER(ciudad) LIKE LOWER(?)";
    params.push(`%${destino}%`);
  }

  const [rows] = await db.query(query, params);

  console.log("🏨 Hoteles encontrados:", rows.length);

  return rows;
}

module.exports = buscarHoteles;