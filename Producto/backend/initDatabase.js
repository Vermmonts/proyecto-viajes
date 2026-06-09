const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { dbConfig } = require('./db');
require('dotenv').config();

const DB_NAME = process.env.DB_NAME || 'viajes_app';
if (!/^[a-zA-Z0-9_]+$/.test(DB_NAME)) {
  throw new Error('DB_NAME solo puede contener letras, números y guion bajo.');
}
const databaseDir = path.join(__dirname, '..', 'database');

async function runSqlFile(connection, filename) {
  const sqlPath = path.join(databaseDir, filename);
  const sql = fs.readFileSync(sqlPath, 'utf8').replace(/viajes_app/g, DB_NAME);
  const statements = sql
    .split(/;\s*(?:\r?\n|$)/)
    .map(s => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await connection.query(statement);
  }
}

async function tableExists(connection, table) {
  const [rows] = await connection.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
    [DB_NAME, table]
  );
  return rows.length > 0;
}

async function columnExists(connection, table, column) {
  const [rows] = await connection.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [DB_NAME, table, column]
  );
  return rows.length > 0;
}

async function addColumnIfMissing(connection, table, column, definition) {
  const exists = await columnExists(connection, table, column);
  if (!exists) {
    await connection.query(`ALTER TABLE \`${DB_NAME}\`.\`${table}\` ADD COLUMN ${definition}`);
  }
}

async function modifyColumnIfExists(connection, table, column, definition) {
  const exists = await columnExists(connection, table, column);
  if (exists) {
    try {
      await connection.query(`ALTER TABLE \`${DB_NAME}\`.\`${table}\` MODIFY COLUMN ${definition}`);
    } catch (error) {
      console.warn(`No se pudo modificar ${table}.${column}: ${error.message}`);
    }
  }
}

async function ensureMigrations(connection) {
  await connection.query(`USE \`${DB_NAME}\``);

  if (await tableExists(connection, 'usuarios')) {
    await addColumnIfMissing(connection, 'usuarios', 'password_hash', 'password_hash VARCHAR(255) NULL');
    await addColumnIfMissing(connection, 'usuarios', 'fecha_creacion', 'fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    // Compatibilidad con el SQL anterior, que tenía password NOT NULL.
    await modifyColumnIfExists(connection, 'usuarios', 'password', 'password VARCHAR(255) NULL');
  }

  if (await tableExists(connection, 'vuelos')) {
    await addColumnIfMissing(connection, 'vuelos', 'codigo_origen', 'codigo_origen VARCHAR(10) NULL');
    await addColumnIfMissing(connection, 'vuelos', 'codigo_destino', 'codigo_destino VARCHAR(10) NULL');
    await addColumnIfMissing(connection, 'vuelos', 'hora_salida', 'hora_salida TIME NULL');
    await addColumnIfMissing(connection, 'vuelos', 'hora_regreso', 'hora_regreso TIME NULL');
    await addColumnIfMissing(connection, 'vuelos', 'puntuacion', 'puntuacion DECIMAL(3,2) DEFAULT 4.0');
    await addColumnIfMissing(connection, 'vuelos', 'disponible', 'disponible BOOLEAN DEFAULT TRUE');
  }

  if (await tableExists(connection, 'hoteles')) {
    await addColumnIfMissing(connection, 'hoteles', 'direccion', 'direccion VARCHAR(255) NULL');
    await addColumnIfMissing(connection, 'hoteles', 'imagen', 'imagen VARCHAR(500) NULL');
    await addColumnIfMissing(connection, 'hoteles', 'disponible', 'disponible BOOLEAN DEFAULT TRUE');
    await addColumnIfMissing(connection, 'hoteles', 'puntuacion', 'puntuacion DECIMAL(3,2) DEFAULT 4.0');

    if (await columnExists(connection, 'hoteles', 'valoracion')) {
      await connection.query(`UPDATE \`${DB_NAME}\`.hoteles SET puntuacion = valoracion WHERE puntuacion IS NULL OR puntuacion = 4.0`);
    }
  }

  if (await tableExists(connection, 'viajes_guardados')) {
    await addColumnIfMissing(connection, 'viajes_guardados', 'estado', "estado VARCHAR(30) DEFAULT 'planificado'");
    await addColumnIfMissing(connection, 'viajes_guardados', 'notas', 'notas VARCHAR(500) NULL');
    await addColumnIfMissing(connection, 'viajes_guardados', 'fecha_guardado', 'fecha_guardado TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    await addColumnIfMissing(connection, 'viajes_guardados', 'fecha_actualizacion', 'fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    await modifyColumnIfExists(connection, 'viajes_guardados', 'estado', "estado VARCHAR(30) DEFAULT 'planificado'");
  }
}

async function ensureDatabase() {
  const connection = await mysql.createConnection({
    host: dbConfig.host,
    user: dbConfig.user,
    password: dbConfig.password,
    port: dbConfig.port,
    multipleStatements: true
  });

  try {
    await runSqlFile(connection, 'script.sql');
    await ensureMigrations(connection);

    const [[vuelos]] = await connection.query(`SELECT COUNT(*) AS total FROM \`${DB_NAME}\`.vuelos`);
    const [[hoteles]] = await connection.query(`SELECT COUNT(*) AS total FROM \`${DB_NAME}\`.hoteles`);

    if (Number(vuelos.total) === 0 || Number(hoteles.total) === 0) {
      await runSqlFile(connection, 'datos_prueba.sql');
      console.log('Base de datos creada y datos de prueba cargados.');
    } else {
      console.log('Base de datos verificada. Tablas, migraciones y datos existentes conservados.');
    }
  } finally {
    await connection.end();
  }
}

module.exports = ensureDatabase;

if (require.main === module) {
  ensureDatabase()
    .then(() => {
      console.log('Configuración de base de datos completada.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error configurando base de datos:', error.message);
      process.exit(1);
    });
}
