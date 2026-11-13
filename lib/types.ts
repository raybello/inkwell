export type ProjectType = "book" | "ebook" | "article" | "blog" | "custom";
export type ChapterStatus = "draft" | "in_progress" | "complete" | "needs_review";
export type Role = "owner" | "editor" | "reviewer" | "viewer";

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  plan: "free" | "pro" | "studio";
  /** Unrestricted access: every project, no plan limits. Set in the database. */
  is_admin: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  owner_id: string;
  title: string;
  subtitle: string | null;
  type: ProjectType;
  genre: string | null;
  cover_image_url: string | null;
  /** Editable cover layer documents (see lib/cover-art.ts). */
  cover_front?: unknown;
  cover_back?: unknown;
  /** Rendered PNGs used by library cards and every export. */
  cover_front_url?: string | null;
  cover_back_url?: string | null;
  description: string | null;
  target_word_count: number | null;
  publishing_target: string | null;
  tags: string[];
  settings: Record<string, unknown>;
  status: string;
  share_token: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface Chapter {
  id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  synopsis: string | null;
  content: unknown | null;
  content_md: string;
  position: number;
  status: ChapterStatus;
  word_count: number;
  pov: string | null;
  arc: string | null;
  subplot: string | null;
  color: string | null;
  tags: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChapterVersion {
  id: string;
  chapter_id: string;
  content: unknown | null;
  content_md: string | null;
  word_count: number;
  saved_by: string | null;
  label: string | null;
  kind: "auto" | "manual";
  created_at: string;
}

export interface Asset {
  id: string;
  project_id: string;
  uploader_id: string | null;
  filename: string;
  storage_path: string;
  public_url: string | null;
  mime_type: string | null;
  size_bytes: number;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  source: string;
  tags: string[];
  created_at: string;
  updated_at?: string;
}

export interface StoryboardCard {
  id: string;
  project_id: string;
  chapter_id: string;
  primary_image_id: string | null;
  mood_image_ids: string[];
  position: number;
  notes: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface Canvas {
  id: string;
  project_id: string;
  name: string;
  content: unknown | null;
  thumbnail_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  chapter_id: string;
  project_id: string;
  author_id: string | null;
  parent_id: string | null;
  anchor_start: number | null;
  anchor_end: number | null;
  quoted_text: string | null;
  body: string;
  resolved: boolean;
  created_at: string;
  author?: Profile | null;
}

export interface ProjectMember {
  project_id: string;
  user_id: string;
  role: Role;
  invited_by: string | null;
  invited_at: string;
  accepted_at: string | null;
  profile?: Profile | null;
}

export interface Note {
  id: string;
  project_id: string;
  chapter_id: string | null;
  kind: "note" | "character" | "location" | "event" | "research";
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  url: string | null;
  tags: string[];
  pinned: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiKey {
  id: string;
  workspace_id: string;
  name: string;
  prefix: string;
  scopes: string[];
  rate_limit_rpm: number;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface ExportJob {
  id: string;
  project_id: string;
  requested_by: string | null;
  format: "markdown" | "docx" | "epub" | "pdf" | "pdf_screen" | "html" | "json";
  style_template: string;
  scope: "project" | "chapter";
  chapter_id: string | null;
  options: Record<string, unknown>;
  status: "queued" | "processing" | "done" | "failed";
  progress: number;
  storage_path: string | null;
  download_url: string | null;
  size_bytes: number | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface Webhook {
  id: string;
  project_id: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  project_id: string | null;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

export interface Activity {
  id: string;
  project_id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  summary: string | null;
  created_at: string;
  actor?: Profile | null;
}

export interface ShareLink {
  id: string;
  project_id: string;
  token: string;
  mode: "project" | "chapter";
  chapter_id: string | null;
  theme: string;
  enabled: boolean;
  created_by: string | null;
  created_at: string;
}

export interface ChapterNode extends Chapter {
  children: ChapterNode[];
}
