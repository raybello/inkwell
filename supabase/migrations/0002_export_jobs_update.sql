-- Export job status transitions by the job owner (editor of the project)
drop policy if exists export_jobs_update on public.export_jobs;
create policy export_jobs_update on public.export_jobs for update
  using (can_edit_project(project_id))
  with check (can_edit_project(project_id));
