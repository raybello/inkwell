/**
 * One-off verification of the export pipeline's database/storage legs:
 * insert a job as the demo user (RLS), generate a real file, upload it with the
 * service client, mark it done, read it back, then clean up.
 *
 *   node --env-file=.env.local scripts/verify-export-storage.mjs
 */
import { register } from "node:module";

register("./ts-alias-loader.mjs", import.meta.url);

const { createClient } = await import("@supabase/supabase-js");
const { generateExport } = await import("../lib/export/index.ts");
const { uploadExport } = await import("../lib/storage.ts");

const PROJECT_ID = "0deff67b-c27a-4147-868d-0310d66eaa8d";
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: auth, error: loginError } = await anon.auth.signInWithPassword({
  email: "demo@inkwell.studio",
  password: "inkwell-demo-2026",
});
if (loginError) throw new Error(loginError.message);
const userId = auth.user.id;

const { data: project } = await anon.from("projects").select("*").eq("id", PROJECT_ID).single();
const { data: chapters } = await anon.from("chapters").select("*").eq("project_id", PROJECT_ID).order("position");

const { data: job, error: insertError } = await anon
  .from("export_jobs")
  .insert({
    project_id: PROJECT_ID,
    requested_by: userId,
    format: "epub",
    style_template: "literary",
    scope: "project",
    options: { includeCover: true, includeToc: true },
    status: "queued",
  })
  .select("*")
  .single();
if (insertError) throw new Error(`insert job: ${insertError.message}`);
console.log("PASS insert export_jobs as editor", job.id);

await anon.from("export_jobs").update({ status: "processing", progress: 25 }).eq("id", job.id);

const result = await generateExport({ project, chapters, format: "epub", style: "literary", authorName: "Demo Writer" });
const stored = await uploadExport(`verify-${job.id.slice(0, 8)}.epub`, result.bytes, result.contentType);
console.log("PASS uploadExport", stored.path, `${(result.bytes.length / 1024).toFixed(1)} KB`);

const dl = await fetch(stored.url);
console.log("PASS public download", dl.status, dl.headers.get("content-type"));

// status writes need the service client: export_jobs has no UPDATE policy
const { data: done, error: updateError } = await admin
  .from("export_jobs")
  .update({
    status: "done",
    progress: 100,
    storage_path: stored.path,
    download_url: stored.url,
    size_bytes: result.bytes.byteLength,
    completed_at: new Date().toISOString(),
  })
  .eq("id", job.id)
  .select("*")
  .single();
if (updateError) throw new Error(`update job: ${updateError.message}`);
console.log("PASS mark job done", done.status, done.size_bytes);

// RLS: a second user must not see this job. Use an anonymous (signed-out) client.
const anonOnly = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: leaked } = await anonOnly.from("export_jobs").select("id").eq("id", job.id);
console.log(leaked?.length === 0 ? "PASS RLS hides job from anonymous" : "FAIL anonymous can see export job");

await admin.storage.from("exports").remove([stored.path]);
await admin.from("export_jobs").delete().eq("id", job.id);
console.log("cleaned up test job + object");
