import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PROJECT = '0deff67b-c27a-4147-868d-0310d66eaa8d';

const { data: project } = await admin.from('projects').select('id, owner_id').eq('id', PROJECT).single();
if (!project) throw new Error('project missing');

function svg({ w = 800, h = 1000, from, to, accent, rings = 5, horizon = 0.62, label }) {
  const lines = [];
  for (let i = 0; i < rings; i += 1) {
    const y = h * horizon + i * 14;
    lines.push(
      `<path d="M0 ${y} Q ${w * 0.25} ${y - 18 - i * 3} ${w * 0.5} ${y - 4} T ${w} ${y - 10}" stroke="${accent}" stroke-opacity="${0.22 - i * 0.03}" fill="none" stroke-width="2"/>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="0.65" stop-color="${to}"/>
      <stop offset="1" stop-color="#0d0c0b"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.62" cy="0.34" r="0.5">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#sky)"/>
  <rect width="${w}" height="${h}" fill="url(#glow)"/>
  <circle cx="${w * 0.62}" cy="${h * 0.34}" r="${w * 0.09}" fill="${accent}" fill-opacity="0.55"/>
  ${lines.join('\n  ')}
  <text x="${w * 0.5}" y="${h * 0.93}" text-anchor="middle" font-family="Georgia, serif" font-size="${w * 0.045}" fill="#e8ddcb" fill-opacity="0.5" letter-spacing="6">${label}</text>
</svg>`;
}

const images = [
  { name: 'low-water.svg', label: 'LOW WATER', from: '#2b3742', to: '#4a5a63', accent: '#c8a67a' },
  { name: 'the-surveyor.svg', label: 'THE SURVEYOR', from: '#1f2a28', to: '#3d5148', accent: '#9fc0a4' },
  { name: 'flooded-cellar.svg', label: 'FLOODED CELLAR', from: '#241f2c', to: '#3a3046', accent: '#a98ab0' },
  { name: 'long-walk.svg', label: 'THE LONG WALK', from: '#2a2118', to: '#4a3826', accent: '#d8a76a' },
  { name: 'cover-north-coast.svg', label: 'THE SALT ROAD', from: '#191d24', to: '#3b444d', accent: '#c8814a' },
];

let created = 0;
for (const img of images) {
  const path_ = `${PROJECT}/seed-${img.name}`;
  const body = Buffer.from(svg(img));
  const { error } = await admin.storage.from('assets').upload(path_, body, {
    contentType: 'image/svg+xml',
    upsert: true,
  });
  if (error) {
    console.error('upload failed', img.name, error.message);
    continue;
  }
  const { data: pub } = admin.storage.from('assets').getPublicUrl(path_);
  const { data: existing } = await admin
    .from('assets')
    .select('id')
    .eq('project_id', PROJECT)
    .eq('storage_path', path_)
    .maybeSingle();
  if (existing) continue;
  const { error: dbError } = await admin.from('assets').insert({
    project_id: PROJECT,
    uploader_id: project.owner_id,
    filename: img.name.replace('.svg', '.svg'),
    storage_path: path_,
    public_url: pub.publicUrl,
    mime_type: 'image/svg+xml',
    size_bytes: body.length,
    width: 800,
    height: 1000,
    alt_text: img.label,
    source: 'upload',
    tags: ['mood', 'coast'],
  });
  if (dbError) console.error('insert failed', img.name, dbError.message);
  else created += 1;
}

console.log('assets created:', created);
