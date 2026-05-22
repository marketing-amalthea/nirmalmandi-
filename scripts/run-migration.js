/**
 * Runs the database migration against Neon PostgreSQL.
 * Usage: node scripts/run-migration.js
 */
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const sqlPath = path.join(__dirname, '..', 'infra', 'migrations', '001_initial_schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('🔌 Connecting to Neon database...');
  const client = await pool.connect();

  try {
    console.log('⚙️  Running migration...');
    await client.query(sql);
    console.log('✅ Migration complete!\n');

    const { rows } = await client.query('SELECT slug, commission_rate FROM sectors ORDER BY slug');
    console.log('📦 Sectors seeded:');
    rows.forEach(r => console.log(`   ${r.slug}: ${(r.commission_rate * 100).toFixed(1)}% commission`));

    const { rows: tables } = await client.query(
      `SELECT count(*) as count FROM information_schema.tables WHERE table_schema = 'public'`
    );
    console.log(`\n📊 Total tables created: ${tables[0].count}`);
    console.log('\n🎉 Database is ready!');
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('ℹ️  Tables already exist — migration already ran. Skipping.');
    } else {
      console.error('❌ Migration failed:', err.message);
      process.exit(1);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run();
