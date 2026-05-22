/**
 * Seeds admin user. Usage: node scripts/seed-admin.js +91XXXXXXXXXX "Name"
 */
require('dotenv').config();
const { Pool } = require('pg');

const phone = process.argv[2];
const name  = process.argv[3] || 'Admin';

if (!phone) {
  console.error('❌ Usage: node scripts/seed-admin.js +91XXXXXXXXXX "Your Name"');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function seed() {
  const client = await pool.connect();
  try {
    const existing = await client.query('SELECT id, role FROM users WHERE phone = $1', [phone]);

    if (existing.rows.length > 0) {
      await client.query(
        `UPDATE users SET role = 'admin', name = $1, updated_at = NOW() WHERE phone = $2`,
        [name, phone]
      );
      console.log(`✅ Updated user ${phone} → role=admin`);
    } else {
      await client.query(
        `INSERT INTO users (id, phone, role, name, created_at, updated_at)
         VALUES (uuid_generate_v4(), $1, 'admin', $2, NOW(), NOW())`,
        [phone, name]
      );
      console.log(`✅ Created admin: ${name} (${phone})`);
    }

    console.log(`\n🔑 Login at: http://localhost:3000/login`);
    console.log(`📱 Phone: ${phone}`);
    console.log(`💬 OTP will appear in the auth-service terminal (dev mode)\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(e => { console.error('❌', e.message); process.exit(1); });
