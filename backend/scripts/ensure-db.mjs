import pg from 'pg';

const adminUrl = process.env.ADMIN_DATABASE_URL;
const database = process.env.APP_DATABASE ?? 'rohi_travel';
if (!/^[a-z_]+$/.test(database)) {
  throw new Error('APP_DATABASE must be a simple lowercase name.');
}
if (!adminUrl) {
  throw new Error('Set ADMIN_DATABASE_URL to the prisma dev template1 connection.');
}

const client = new pg.Client({ connectionString: adminUrl });
await client.connect();
const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
if (exists.rowCount === 0) {
  await client.query(`CREATE DATABASE ${database}`);
  console.log(`created ${database}`);
} else {
  console.log(`${database} already exists`);
}
await client.end();
