require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query("UPDATE users SET phone = '9458720186' WHERE phone = '+919458720186'").then(r => {
  console.log('Updated rows:', r.rowCount);
  pool.end();
}).catch(e => { console.error(e.message); pool.end(); });
