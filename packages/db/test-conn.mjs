import pg from 'pg';
const { Client } = pg;
const url = process.env.DATABASE_URL;
console.log('Connecting to:', url?.replace(/:[^@]+@/, ':***@'));
const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
try {
  await c.connect();
  const r = await c.query('SELECT version(), current_database(), current_user');
  console.log('OK:', JSON.stringify(r.rows[0], null, 2));
  await c.end();
  process.exit(0);
} catch (e) {
  console.error('FAIL:', e.message);
  process.exit(1);
}
