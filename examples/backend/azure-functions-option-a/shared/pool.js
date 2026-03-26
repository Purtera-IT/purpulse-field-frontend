const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    const conn = process.env.DATABASE_URL || process.env.PG_CONN;
    if (!conn) throw new Error('DATABASE_URL or PG_CONN not set');
    pool = new Pool({ connectionString: conn, max: 5, ssl: { rejectUnauthorized: true } });
  }
  return pool;
}

module.exports = { getPool };
