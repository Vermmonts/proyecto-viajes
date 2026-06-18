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

async function indexExists(connection, table, indexName) {
  const [rows] = await connection.query(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    [DB_NAME, table, indexName]
  );
  return rows.length > 0;
}

async function ensureUniqueUserEmail(connection) {
  if (!await tableExists(connection, 'usuarios')) return;

  // Normaliza espacios y mayúsculas cuando no existen correos equivalentes duplicados.
  const [duplicates] = await connection.query(`
    SELECT LOWER(TRIM(email)) AS normalized_email, COUNT(*) AS total
    FROM \`${DB_NAME}\`.usuarios
    GROUP BY LOWER(TRIM(email))
    HAVING COUNT(*) > 1
    LIMIT 1
  `);

  if (duplicates.length) {
    console.warn('No se agregó el índice único de correo porque existen usuarios duplicados en la base. El registro igualmente bloqueará nuevos duplicados.');
    return;
  }

  await connection.query(`UPDATE \`${DB_NAME}\`.usuarios SET email = LOWER(TRIM(email))`);

  const hasExpectedIndex = await indexExists(connection, 'usuarios', 'uq_usuarios_email');
  if (!hasExpectedIndex) {
    const [indexes] = await connection.query(`SHOW INDEX FROM \`${DB_NAME}\`.usuarios WHERE Non_unique = 0`);
    const emailAlreadyUnique = indexes.some(index => index.Column_name === 'email');
    if (!emailAlreadyUnique) {
      await connection.query(`ALTER TABLE \`${DB_NAME}\`.usuarios ADD UNIQUE INDEX uq_usuarios_email (email)`);
    }
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
    await ensureUniqueUserEmail(connection);
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

  await connection.query(`CREATE TABLE IF NOT EXISTS fuentes_web (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    dominio VARCHAR(180) NULL,
    tipo VARCHAR(40) DEFAULT 'viaje',
    consulta_usuario TEXT NULL,
    contenido_resumen TEXT NULL,
    fecha_consulta TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await connection.query(`CREATE TABLE IF NOT EXISTS resultados_web_viajes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fuente_id INT NULL,
    origen VARCHAR(120) NULL,
    destino VARCHAR(120) NULL,
    tipo VARCHAR(40) DEFAULT 'referencia',
    nombre VARCHAR(255) NULL,
    precio_estimado DECIMAL(14,2) NULL,
    moneda VARCHAR(10) DEFAULT 'CLP',
    url TEXT NOT NULL,
    descripcion TEXT NULL,
    fecha_consulta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_web_destino (destino),
    CONSTRAINT fk_resultado_fuente FOREIGN KEY (fuente_id) REFERENCES fuentes_web(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);


  await connection.query(`CREATE TABLE IF NOT EXISTS viajes_web_guardados (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    origen VARCHAR(120) NULL,
    destino VARCHAR(120) NULL,
    aeropuerto_llegada VARCHAR(180) NULL,
    fechas VARCHAR(180) NULL,
    personas INT DEFAULT 1,
    proveedor_vuelo VARCHAR(180) NULL,
    alojamiento VARCHAR(255) NULL,
    total_estimado DECIMAL(14,2) NULL,
    moneda VARCHAR(10) DEFAULT 'CLP',
    url_reserva TEXT NULL,
    fuente_json JSON NULL,
    estado VARCHAR(30) DEFAULT 'planificado',
    notas VARCHAR(500) NULL,
    fecha_guardado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_viajes_web_usuario (usuario_id),
    CONSTRAINT fk_viajes_web_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

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

    console.log('Base de datos verificada. Se utilizará únicamente para usuarios, historial, fuentes y viajes guardados; las búsquedas se realizan siempre en internet mediante Tavily y se analizan localmente con Ollama.');
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
