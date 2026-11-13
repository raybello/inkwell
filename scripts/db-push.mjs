import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

const client = new pg.Client({
  host: `db.${process.env.SUPABASE_PROJECT_REF}.supabase.co`,
  port: 5432,
  user: 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const dir = path.join(process.cwd(), 'supabase/migrations');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
for (const f of files) {
  const sql = fs.readFileSync(path.join(dir, f), 'utf8');
  process.stdout.write(`applying ${f} ... `);
  try {
    await client.query(sql);
    console.log('ok');
  } catch (e) {
    console.log('FAILED');
    console.error(e.message);
    if (e.position) console.error('position', e.position, 'detail', e.detail);
    await client.end();
    process.exit(1);
  }
}
const { rows } = await client.query(
  `select table_name from information_schema.tables where table_schema='public' order by 1`,
);
console.log(`\n${rows.length} public tables:`, rows.map((r) => r.table_name).join(', '));
await client.end();
