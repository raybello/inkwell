import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.join(process.cwd(), '.env.local');
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const EMAIL = 'demo@inkwell.studio';
const PASSWORD = 'inkwell-demo-2026';

function mdToDoc(md) {
  if (!md.trim()) return { type: 'doc', content: [{ type: 'paragraph' }] };
  const content = [];
  for (const block of md.split(/\n{2,}/)) {
    const t = block.trim();
    if (!t) continue;
    const h = t.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      content.push({ type: 'heading', attrs: { level: h[1].length }, content: [{ type: 'text', text: h[2] }] });
    } else if (t.startsWith('> ')) {
      content.push({
        type: 'blockquote',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: t.replace(/^> /gm, '') }] }],
      });
    } else {
      content.push({ type: 'paragraph', content: [{ type: 'text', text: t.replace(/\n/g, ' ') }] });
    }
  }
  return { type: 'doc', content };
}

// ---------- user ----------
let userId;
const { data: existing } = await admin.auth.admin.listUsers({ perPage: 200 });
const found = existing?.users?.find((u) => u.email === EMAIL);
if (found) {
  userId = found.id;
  console.log('user exists', userId);
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: 'Ada Marlowe' },
  });
  if (error) throw error;
  userId = data.user.id;
  console.log('user created', userId);
}

await admin.from('profiles').upsert({
  id: userId,
  email: EMAIL,
  display_name: 'Ada Marlowe',
  plan: 'pro',
});

// ---------- project ----------
const { data: existingProjects } = await admin.from('projects').select('id').eq('owner_id', userId);
if (existingProjects?.length) {
  console.log('seed project already present:', existingProjects.length);
  process.exit(0);
}

const { data: project, error: pErr } = await admin
  .from('projects')
  .insert({
    owner_id: userId,
    title: 'The Salt Road',
    subtitle: 'A novel of the northern coast',
    type: 'book',
    genre: 'Literary Fiction',
    description:
      'A cartographer returns to a town that no longer appears on her maps — and finds the coastline has been rewritten by everyone who stayed.',
    target_word_count: 82000,
    publishing_target: 'amazon_kdp',
    tags: ['slow-burn', 'coastal', 'dual-timeline'],
  })
  .select('*')
  .single();
if (pErr) throw pErr;
console.log('project', project.id);

const chapters = [
  {
    title: 'Part One — The Chart Room',
    synopsis: 'A framing section that sets the town and the maps.',
    status: 'complete',
    md: `# Part One — The Chart Room\n\nEvery map is a lie agreed upon.`,
  },
  {
    title: 'Chapter One — Low Water',
    synopsis:
      'Mira returns to Ashcombe after eleven years and finds the harbour shifted two hundred metres north.',
    status: 'complete',
    pov: 'Mira',
    arc: 'Act I',
    md: `The bus stopped where the road stopped, which was not where she remembered it.

Mira stepped down onto gravel and stood for a moment with her bag against her shin, waiting for the town to arrange itself into something familiar. The church was there. The pub was there, its sign repainted a green she did not remember. But the harbour — the harbour was in the wrong place.

"You'll want the path," said the driver, already closing the doors. "Tide's out."

She had drawn this coastline four hundred times. She had inked the breakwater at forty degrees, the lifeboat house at the north end, the shingle bank that ran out like a thumb. None of it was where she had left it.

The sea had simply moved, the way a person moves in their sleep.

---

Her father's house still had the same key, under the same cracked pot, and she stood on the step for a long minute before she used it. Inside, the air was cold and salt-stiff and absolutely unchanged. The charts were where she had left them, rolled in the umbrella stand. The kettle was where he had left it, on the hob.

She unrolled the first chart on the kitchen table and put her palm flat against Ashcombe, against the little black anchor that meant safe water. Then she took a pencil from her coat and, very lightly, began to draw the town she was actually standing in.`,
  },
  {
    title: 'Chapter Two — The Surveyor',
    synopsis:
      'Mira meets Elias, who has been mapping the eroding cliff for the council and knows more than he says.',
    status: 'in_progress',
    pov: 'Mira',
    arc: 'Act I',
    md: `Elias Crowe had the hands of a man who worked outdoors and the vocabulary of a man who read at night.

"You're the cartographer," he said, not quite a question.

"I'm a cartographer."

"Then you'll know what I'm looking at." He spread a survey on the seawall, weighing the corners with stones. "Ten years of measurements. The cliff is going, but it isn't going evenly. It's going in steps. Like stairs."

Mira crouched. The contour lines bunched at the northern end, then relaxed, then bunched again.

"Steps," she agreed. "Someone's been taking the land."

"Someone's been *taking* it." He looked at her for a moment too long. "That's an odd way to put it."

She didn't answer. Below them the tide was coming in over ground that should have been dry, and somewhere under the noise of it she could hear the particular hush of water finding a new room in a house.`,
  },
  {
    title: 'Chapter Three — What the Water Kept',
    synopsis: 'A discovery in the flooded cellar reframes the family history.',
    status: 'needs_review',
    pov: 'Mira',
    arc: 'Act II',
    md: `The cellar had been dry for as long as she could remember. It was not dry now.

She stood at the top of the steps with a torch and watched the beam slide across black water, and across the thing floating in it: a tin box, painted green, the paint lifting in flakes like a disease.

She went down four steps. The cold came through her boots immediately.

"Don't," said a voice behind her, and she did not turn, because she knew the voice, and because she had spent eleven years deciding what she would say if she ever heard it again, and none of it was any use now.`,
  },
  {
    title: 'Chapter Four — The Long Walk',
    synopsis: 'Mira walks the whole coastline in a single night, measuring it by foot.',
    status: 'draft',
    pov: 'Mira',
    arc: 'Act II',
    md: '',
  },
];

let position = 0;
const inserted = [];
for (const ch of chapters) {
  const { data, error } = await admin
    .from('chapters')
    .insert({
      project_id: project.id,
      title: ch.title,
      synopsis: ch.synopsis,
      status: ch.status,
      pov: ch.pov ?? null,
      arc: ch.arc ?? null,
      position: position++,
      content_md: ch.md,
      content: mdToDoc(ch.md),
    })
    .select('*')
    .single();
  if (error) throw error;
  inserted.push(data);
}
console.log('chapters', inserted.length);

// storyboard cards
for (const [i, ch] of inserted.entries()) {
  await admin.from('storyboard_cards').insert({
    project_id: project.id,
    chapter_id: ch.id,
    position: i,
    notes: ch.synopsis,
    color: ['#c8814a', '#7d9a7e', '#8b6b8f', '#a8825f', '#5f7d8b'][i % 5],
  });
}

// canvas
await admin.from('canvases').insert({
  project_id: project.id,
  name: 'Plot Arcs',
  content: { tldraw: null },
  created_by: userId,
});
await admin.from('canvases').insert({
  project_id: project.id,
  name: 'Ashcombe — World Map',
  content: { tldraw: null },
  created_by: userId,
});

// notes
const notes = [
  {
    kind: 'character',
    title: 'Mira Vance',
    body: 'Cartographer, 41. Left Ashcombe at 30 after the funeral. Draws from memory when anxious.',
    data: { role: 'Protagonist', traits: 'Precise, guarded, stubborn', arc: 'Learns that accuracy is not the same as truth' },
  },
  {
    kind: 'character',
    title: 'Elias Crowe',
    body: 'Council surveyor. Knows the cliff is being moved deliberately. Brother of the man Mira left behind.',
    data: { role: 'Ally / mirror', traits: 'Patient, evasive, kind', arc: 'Chooses the town over his brother' },
  },
  {
    kind: 'location',
    title: 'Ashcombe',
    body: 'Fishing town on a shifting coast. Harbour moved 200m north in eleven years. Population 1,400 and falling.',
    data: { region: 'North coast', mood: 'Salt, wet stone, low light' },
  },
  { kind: 'research', title: 'Coastal erosion rates', body: 'Average 1.2m/yr on soft cliff; dramatic after storm years.', url: 'https://www.gov.uk/coastal-erosion' },
];
for (const n of notes) {
  await admin.from('notes').insert({ ...n, project_id: project.id, created_by: userId, tags: [] });
}

// a comment thread
const { data: comment } = await admin
  .from('comments')
  .insert({
    chapter_id: inserted[2].id,
    project_id: project.id,
    author_id: userId,
    anchor_start: 0,
    anchor_end: 48,
    quoted_text: 'The cellar had been dry for as long as she could remember.',
    body: 'This opening is doing a lot of work — consider letting the reader feel the cold before the reveal.',
  })
  .select('*')
  .single();
if (comment) {
  await admin.from('comments').insert({
    chapter_id: inserted[2].id,
    project_id: project.id,
    author_id: userId,
    parent_id: comment.id,
    body: 'Agreed. I will move the torch detail up a paragraph.',
  });
}

// activity
await admin.from('activities').insert([
  { project_id: project.id, actor_id: userId, action: 'project.created', summary: 'Created the project' },
  { project_id: project.id, actor_id: userId, action: 'chapter.updated', target_id: inserted[2].id, summary: 'Revised Chapter Three' },
  { project_id: project.id, actor_id: userId, action: 'asset.uploaded', summary: 'Added mood references' },
]);

console.log('\nSEED OK');
console.log('login:', EMAIL, '/', PASSWORD);
console.log('project:', project.id);
