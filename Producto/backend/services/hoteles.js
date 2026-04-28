const db = require("../db");

async function buscarHoteles(ciudad) {

  const [rows] = await db.execute(

    `
      SELECT *
      FROM hoteles
      WHERE ciudad = ?
      ORDER BY rating DESC
    `,

    [ciudad]

  );

  return rows;
}

module.exports = buscarHoteles;