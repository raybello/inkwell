import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const SOURCE = '0deff67b-c27a-4147-868d-0310d66eaa8d';
const TARGET_EMAIL = 'raymondbello11@gmail.com';

const { data: profiles } = await admin.from('profiles').select('id,email');
const ray = profiles.find((p) => p.email === TARGET_EMAIL);
if (!ray) throw new Error('target profile not found');

// 1. Unrestricted access
await admin.from('profiles').update({ is_admin: true }).eq('id', ray.id);

// 2. Own copy of the sample project (so it can be opened and deleted by RayB)
const { data: owned } = await admin.from('projects').select('id,settings').eq('owner_id', ray.id);
const already = (owned ?? []).find(
  (p) => (p.settings ?? {}).sample === true && (p.settings ?? {}).source_project_id === SOURCE,
);

if (already) {
  console.log('sample project already present:', already.id);
} else {
  const { data: src } = await admin.from('projects').select('*').eq('id', SOURCE).single();
  const { id: _id, created_at, updated_at, share_token, ...rest } = src;

  const { data: copy, error } = await admin
    .from('projects')
    .insert({
      ...rest,
      owner_id: ray.id,
      is_public: false,
      share_token: null,
      settings: { ...(src.settings ?? {}), sample: true, source_project_id: SOURCE },
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;

  const chapterMap = new Map();
  const { data: chapters } = await admin.from('chapters').select('*').eq('project_id', SOURCE).order('position');
  for (const ch of chapters ?? []) {
    const { id, created_at, updated_at, ...c } = ch;
    const { data: inserted, error: cErr } = await admin
      .from('chapters')
      .insert({ ...c, project_id: copy.id })
      .select('id')
      .single();
    if (cErr) throw cErr;
    chapterMap.set(id, inserted.id);
  }

  // Copy asset bytes into the new project's folder so deleting one project can't
  // orphan or destroy the other's images.
  const assetMap = new Map();
  const { data: assets } = await admin.from('assets').select('*').eq('project_id', SOURCE);
  for (const asset of assets ?? []) {
    const { id, created_at, ...a } = asset;
    const ext = asset.storage_path.split('.').pop() ?? 'bin';
    const newPath = `${copy.id}/sample-${id.slice(0, 8)}.${ext}`;
    const { data: file } = await admin.storage.from('assets').download(asset.storage_path);
    if (!file) continue;
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await admin.storage.from('assets').upload(newPath, bytes, {
      contentType: asset.mime_type ?? 'application/octet-stream',
      upsert: true,
    });
    if (upErr) {
      console.warn('asset copy failed, skipping', asset.filename, upErr.message);
      continue;
    }
    const publicUrl = admin.storage.from('assets').getPublicUrl(newPath).data.publicUrl;
    const { data: newAsset } = await admin
      .from('assets')
      .insert({
        ...a,
        project_id: copy.id,
        uploader_id: ray.id,
        storage_path: newPath,
        public_url: publicUrl,
      })
      .select('id')
      .single();
    if (newAsset) assetMap.set(id, newAsset.id);
  }

  const { data: cards } = await admin.from('storyboard_cards').select('*').eq('project_id', SOURCE);
  for (const card of cards ?? []) {
    const { id, created_at, updated_at, ...c } = card;
    await admin.from('storyboard_cards').insert({
      ...c,
      project_id: copy.id,
      chapter_id: chapterMap.get(card.chapter_id) ?? null,
      primary_image_id: c.primary_image_id ? assetMap.get(c.primary_image_id) ?? null : null,
      mood_image_ids: (c.mood_image_ids ?? []).map((aid) => assetMap.get(aid)).filter(Boolean),
    });
  }

  const { data: notes } = await admin.from('notes').select('*').eq('project_id', SOURCE);
  for (const note of notes ?? []) {
    const { id, created_at, updated_at, ...n } = note;
    await admin.from('notes').insert({
      ...n,
      project_id: copy.id,
      created_by: ray.id,
      chapter_id: n.chapter_id ? chapterMap.get(n.chapter_id) ?? null : null,
    });
  }

  const { data: canvases } = await admin.from('canvases').select('*').eq('project_id', SOURCE);
  for (const canvas of canvases ?? []) {
    const { id, created_at, updated_at, ...c } = canvas;
    await admin.from('canvases').insert({ ...c, project_id: copy.id, created_by: ray.id, content: null });
  }

  await admin.from('activities').insert({
    project_id: copy.id,
    actor_id: ray.id,
    action: 'project.created',
    summary: 'Sample project copied into your library',
  });

  console.log('sample project created:', copy.id, '| assets copied:', assetMap.size);
}

console.log('is_admin set for', TARGET_EMAIL);
