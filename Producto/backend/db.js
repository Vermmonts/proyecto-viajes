const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  port: Number(process.env.DB_PORT || 3307),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true
};

const pool = mysql.createPool({
  ...dbConfig,
  database: process.env.DB_NAME || 'viajes_app'
});

module.exports = pool;
module.exports.dbConfig = dbConfig;
