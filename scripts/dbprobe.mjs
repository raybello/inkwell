import pg from 'pg';

const pw = process.env.PGPW;
const project = 'vafezjjaswviklokfzlo';
const candidates = [
  { label: 'direct-5432', host: `db.${project}.supabase.co`, port: 5432, user: 'postgres' },
];
const regions = ['us-east-1','us-west-1','us-east-2','eu-central-1','eu-west-1','ap-southeast-1','ap-northeast-1','ca-central-1','sa-east-1','ap-south-1','eu-west-2','us-west-2'];
for (const r of regions) {
  candidates.push({ label: `pooler-${r}`, host: `aws-0-${r}.pooler.supabase.com`, port: 6543, user: `postgres.${project}` });
  candidates.push({ label: `pooler-${r}-5432`, host: `aws-0-${r}.pooler.supabase.com`, port: 5432, user: `postgres.${project}` });
}

for (const c of candidates) {
  const client = new pg.Client({ host: c.host, port: c.port, user: c.user, password: pw, database: 'postgres', ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 6000 });
  try {
    await client.connect();
    const r = await client.query('select current_database(), version()');
    console.log('OK', c.label, r.rows[0].current_database, r.rows[0].version.slice(0, 40));
    await client.end();
    console.log('WINNER', JSON.stringify(c));
    break;
  } catch (e) {
    console.log('FAIL', c.label, String(e.message).slice(0, 90));
    try { await client.end(); } catch {}
  }
}
