/**
 * The API reference content. Kept as data so the docs UI stays a renderer and
 * examples are guaranteed to be valid JSON.
 */

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface DocParam {
  name: string;
  type: string;
  required?: boolean;
  description: string;
}

export interface DocEndpoint {
  id: string;
  method: HttpMethod;
  path: string;
  title: string;
  description: string;
  scopes: string[];
  params?: DocParam[];
  body?: Record<string, unknown> | string;
  response: Record<string, unknown>;
  status?: number;
  notes?: string[];
}

export interface DocSection {
  id: string;
  title: string;
  description?: string;
  endpoints: DocEndpoint[];
}

const PROJECT = {
  id: "0deff67b-c27a-4147-868d-0310d66eaa8d",
  title: "The Salt Road",
  subtitle: "A novel of the interior",
  type: "book",
  genre: "Literary fiction",
  description: "A cartographer returns to a town that has forgotten her.",
  cover_image_url: null,
  target_word_count: 90000,
  publishing_target: "Autumn 2027",
  tags: ["literary", "desert"],
  status: "draft",
  is_public: false,
  settings: {},
  created_at: "2026-02-11T09:14:00.000Z",
  updated_at: "2026-03-02T17:41:22.000Z",
  role: "owner",
  chapter_count: 5,
  word_count: 18420,
  asset_count: 12,
};

const CHAPTER_SUMMARY = {
  id: "3f1c9b1e-5f0a-4b7e-9f5e-2f6b8a1c4d20",
  project_id: PROJECT.id,
  parent_id: null,
  title: "Chapter One — The survey",
  synopsis: "Mara arrives with instruments she no longer trusts.",
  status: "draft",
  position: 0,
  word_count: 3120,
  pov: "Mara",
  tags: ["arrival"],
  created_at: "2026-02-11T09:20:00.000Z",
  updated_at: "2026-03-01T12:02:00.000Z",
  children: [],
};

const CHAPTER = {
  ...CHAPTER_SUMMARY,
  arc: "Return",
  subplot: null,
  color: "#c8814a",
  notes: null,
  content: {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "The survey" }] },
      { type: "paragraph", content: [{ type: "text", text: "The road came back before the town did." }] },
    ],
  },
  content_md: "# The survey\n\nThe road came back before the town did.",
  blocks: [
    { bid: "0", type: "heading", attrs: { level: 1 }, text: "The survey" },
    { bid: "1", type: "paragraph", text: "The road came back before the town did." },
  ],
};

const ASSET = {
  id: "b6b0f0d4-8a53-4c2b-8f90-1a2b3c4d5e6f",
  filename: "salt-flats.png",
  url: "https://<project>.supabase.co/storage/v1/object/public/assets/0deff67b/salt-flats.png",
  mime_type: "image/png",
  size_bytes: 184320,
  width: null,
  height: null,
  alt_text: "Cracked salt plain at dusk",
  source: "upload",
  tags: ["mood"],
  created_at: "2026-03-01T11:14:00.000Z",
};

const STORY_CARD = {
  id: "c1a2b3c4-d5e6-4f70-8a91-b2c3d4e5f601",
  chapter_id: CHAPTER.id,
  chapter_title: "Chapter One — The survey",
  position: 0,
  notes: "Hold the image until the third act.",
  color: null,
  primary_image: { id: ASSET.id, url: ASSET.url, filename: ASSET.filename },
  mood_images: [],
  updated_at: "2026-03-02T10:00:00.000Z",
};

const PROJECT_LIST = {
  id: PROJECT.id,
  title: PROJECT.title,
  subtitle: PROJECT.subtitle,
  type: PROJECT.type,
  genre: PROJECT.genre,
  description: PROJECT.description,
  cover_image_url: PROJECT.cover_image_url,
  target_word_count: PROJECT.target_word_count,
  publishing_target: PROJECT.publishing_target,
  tags: PROJECT.tags,
  status: PROJECT.status,
  is_public: PROJECT.is_public,
  settings: PROJECT.settings,
  created_at: PROJECT.created_at,
  updated_at: PROJECT.updated_at,
  role: "owner",
  chapter_count: 5,
  word_count: 18420,
};

const EXPORT_JOB = {
  id: "9e8d7c6b-5a49-4382-9170-0f1e2d3c4b5a",
  project_id: PROJECT.id,
  format: "epub",
  style_template: "literary",
  scope: "project",
  chapter_id: null,
  status: "queued",
  progress: 0,
  download_url: null,
  size_bytes: null,
  error: null,
  created_at: "2026-03-02T12:00:00.000Z",
  started_at: null,
  completed_at: null,
};

export const ENDPOINT_SECTIONS: DocSection[] = [
  {
    id: "projects",
    title: "Projects",
    description:
      "A project is a manuscript: book, ebook, article or blog. Project metadata is shared; chapter bodies are read separately so list calls stay small.",
    endpoints: [
      {
        id: "list-projects",
        method: "GET",
        path: "/api/v1/projects",
        title: "List projects",
        description:
          "Returns every project the key's workspace owns or collaborates on, newest activity first, with word and chapter counts.",
        scopes: ["projects:read"],
        params: [
          { name: "limit", type: "integer", description: "Page size, 1–100. Default 50." },
          { name: "offset", type: "integer", description: "Rows to skip. Default 0." },
        ],
        response: {
          data: [PROJECT_LIST],
          pagination: { limit: 50, offset: 0, total: 1 },
        },
      },
      {
        id: "create-project",
        method: "POST",
        path: "/api/v1/projects",
        title: "Create project",
        description: "Creates a project owned by the key's workspace. New projects start empty.",
        scopes: ["projects:write"],
        body: {
          title: "The Salt Road",
          subtitle: "A novel of the interior",
          type: "book",
          genre: "Literary fiction",
          description: "A cartographer returns to a town that has forgotten her.",
          target_word_count: 90000,
          tags: ["literary", "desert"],
        },
        status: 201,
        response: {
          data: {
            ...PROJECT,
            role: "owner",
            chapter_count: 0,
            word_count: 0,
          },
        },
        notes: ["`type` is one of `book`, `ebook`, `article`, `blog`, `custom`. Defaults to `book`."],
      },
      {
        id: "get-project",
        method: "GET",
        path: "/api/v1/projects/:id",
        title: "Get project",
        description: "Project metadata plus aggregate counts. Returns 404 if the key cannot see the project.",
        scopes: ["projects:read"],
        response: { data: PROJECT },
      },
      {
        id: "update-project",
        method: "PATCH",
        path: "/api/v1/projects/:id",
        title: "Update project",
        description:
          "Partial update. Only supplied fields change. Requires editor or owner access. Fires `project.updated`.",
        scopes: ["projects:write"],
        body: { title: "The Salt Road (revised)", status: "in_progress", tags: ["literary", "desert", "revision"] },
        response: { data: { ...PROJECT, title: "The Salt Road (revised)", status: "in_progress" } },
      },
      {
        id: "delete-project",
        method: "DELETE",
        path: "/api/v1/projects/:id",
        title: "Delete project",
        description:
          "Deletes the project and everything under it — chapters, assets, canvases, exports. Owner only.",
        scopes: ["projects:write"],
        response: { data: { id: PROJECT.id, deleted: true } },
        notes: ["Irreversible. There is no trash can in v1."],
      },
    ],
  },
  {
    id: "chapters",
    title: "Chapters",
    description:
      "Chapters are a self-referential tree. `content` is TipTap JSON; `content_md` is always kept in sync and drives word counts.",
    endpoints: [
      {
        id: "list-chapters",
        method: "GET",
        path: "/api/v1/projects/:id/chapters",
        title: "List chapters (tree)",
        description:
          "Returns the outline. Default `format=tree` nests children under `children`; `format=flat` returns position-ordered rows.",
        scopes: ["chapters:read"],
        params: [{ name: "format", type: "tree | flat", description: "Response shape. Default `tree`." }],
        response: { data: [CHAPTER_SUMMARY], count: 5 },
      },
      {
        id: "create-chapter",
        method: "POST",
        path: "/api/v1/projects/:id/chapters",
        title: "Create chapter",
        description:
          "Creates a chapter or section. Send `content_md` for Markdown or `content` for TipTap JSON — not both. Position defaults to the end of its siblings.",
        scopes: ["chapters:write"],
        body: {
          title: "Chapter Two — The instruments",
          parent_id: null,
          synopsis: "Mara checks the survey against the town's memory.",
          status: "draft",
          content_md: "The theodolite had not moved in nine years.",
        },
        status: 201,
        response: { data: CHAPTER },
        notes: ["Fires `chapter.created`."],
      },
      {
        id: "get-chapter",
        method: "GET",
        path: "/api/v1/projects/:id/chapters/:cid",
        title: "Get chapter",
        description:
          "Full chapter: TipTap `content`, `content_md`, and a numbered `blocks` array for block-level edits. `?format=md` returns raw `text/markdown` for prompts.",
        scopes: ["chapters:read"],
        params: [{ name: "format", type: "json | md", description: "`json` (default) or `md` for a markdown body." }],
        response: { data: CHAPTER },
      },
      {
        id: "update-chapter",
        method: "PATCH",
        path: "/api/v1/projects/:id/chapters/:cid",
        title: "Update chapter",
        description:
          "Partial update of metadata or body. When the body changes, `content_md`, `word_count` and version snapshots are recomputed by the database.",
        scopes: ["chapters:write"],
        body: {
          title: "Chapter Two — Instruments",
          status: "in_progress",
          content_md: "# Instruments\n\nThe theodolite had not moved in nine years.",
        },
        response: { data: CHAPTER },
        notes: ["Fires `chapter.updated`."],
      },
      {
        id: "delete-chapter",
        method: "DELETE",
        path: "/api/v1/projects/:id/chapters/:cid",
        title: "Delete chapter",
        description: "Deletes a chapter and its descendants. Fires `chapter.deleted`.",
        scopes: ["chapters:write"],
        response: { data: { id: CHAPTER.id, deleted: true } },
      },
      {
        id: "reorder-chapters",
        method: "POST",
        path: "/api/v1/projects/:id/chapters/reorder",
        title: "Reorder chapters",
        description:
          "Applies ordering and optional reparenting in one call. Each entry's `position` defaults to its index in the array.",
        scopes: ["chapters:write"],
        body: {
          order: [
            { id: CHAPTER.id, position: 0 },
            { id: "7c2e1a44-6b3d-4e8f-9a10-b2c3d4e5f602", position: 1, parent_id: CHAPTER.id },
          ],
        },
        response: {
          data: [
            { id: CHAPTER.id, parent_id: null, position: 0, title: "Chapter One — The survey" },
            { id: "7c2e1a44-6b3d-4e8f-9a10-b2c3d4e5f602", parent_id: CHAPTER.id, position: 1, title: "Scene ii" },
          ],
        },
      },
    ],
  },
  {
    id: "content-operations",
    title: "Content operations",
    description:
      "Small, idempotent-friendly edits for agents that write continuously. All three keep `content_md` in sync and fire `chapter.updated`.",
    endpoints: [
      {
        id: "append-block",
        method: "POST",
        path: "/api/v1/projects/:id/chapters/:cid/append",
        title: "Append block",
        description: "Adds a block at the end of the chapter. Returns the whole updated chapter.",
        scopes: ["chapters:write"],
        body: { text: "She set the instrument down and listened.", format: "plain", as: "paragraph" },
        response: { data: CHAPTER },
        notes: [
          "`format`: `plain` (default) or `markdown`.",
          "`as`: `paragraph` (default), `heading1`–`heading3`, `blockquote`.",
        ],
      },
      {
        id: "prepend-block",
        method: "POST",
        path: "/api/v1/projects/:id/chapters/:cid/prepend",
        title: "Prepend block",
        description: "Adds a block at the start of the chapter — useful for epigraphs and scene headers.",
        scopes: ["chapters:write"],
        body: { text: "> The map is not the territory.", format: "markdown" },
        response: { data: CHAPTER },
      },
      {
        id: "patch-block",
        method: "PATCH",
        path: "/api/v1/projects/:id/chapters/:cid/blocks/:bid",
        title: "Update a block",
        description:
          "Replaces a block's text and optionally its type or attributes. `bid` is the `blocks[].bid` index from `GET chapter`, or an `attrs.id`/`attrs.blockId` if present.",
        scopes: ["chapters:write"],
        body: { text: "She set the instrument down and listened to the town." },
        response: { data: CHAPTER, block_id: "1" },
        notes: ["Returns 404 `not_found` when the block index does not exist."],
      },
    ],
  },
  {
    id: "assets",
    title: "Assets",
    description:
      "Images, video and PDFs stored in the public `assets` bucket, scoped to the project. Uploads are multipart and capped at 25 MB.",
    endpoints: [
      {
        id: "list-assets",
        method: "GET",
        path: "/api/v1/projects/:id/assets",
        title: "List assets",
        description: "Newest first, paginated.",
        scopes: ["assets:read"],
        params: [
          { name: "limit", type: "integer", description: "1–100. Default 50." },
          { name: "offset", type: "integer", description: "Default 0." },
        ],
        response: { data: [ASSET], pagination: { limit: 50, offset: 0, total: 12 } },
      },
      {
        id: "upload-asset",
        method: "POST",
        path: "/api/v1/projects/:id/assets",
        title: "Upload asset",
        description:
          "`multipart/form-data` with a `file` field, optional `alt_text`, and comma-separated `tags`. Fires `asset.uploaded`.",
        scopes: ["assets:write"],
        body: "curl -X POST https://your-domain.com/api/v1/projects/0deff67b…/assets \\\n  -H \"Authorization: Bearer ink_live_…\" \\\n  -F \"file=@salt-flats.png;type=image/png\" \\\n  -F \"alt_text=Cracked salt plain at dusk\" \\\n  -F \"tags=mood,cover\"",
        status: 201,
        response: { data: ASSET },
        notes: [
          "Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/svg+xml`, `video/mp4`, `application/pdf`.",
          "Oversized files return `413`; unsupported types return `415`.",
        ],
      },
      {
        id: "delete-asset",
        method: "DELETE",
        path: "/api/v1/projects/:id/assets/:aid",
        title: "Delete asset",
        description: "Removes the storage object and the database row.",
        scopes: ["assets:write"],
        response: { data: { id: ASSET.id, deleted: true } },
      },
    ],
  },
  {
    id: "storyboard",
    title: "Storyboard",
    description:
      "Every chapter can carry one storyboard card with a primary image and mood references. Cards are created implicitly when you pin an image.",
    endpoints: [
      {
        id: "get-storyboard",
        method: "GET",
        path: "/api/v1/projects/:id/storyboard",
        title: "Get storyboard",
        description: "Cards ordered by position, joined with chapter titles and asset URLs.",
        scopes: ["chapters:read"],
        response: { data: [STORY_CARD], count: 1 },
      },
      {
        id: "pin-storyboard-image",
        method: "POST",
        path: "/api/v1/projects/:id/storyboard/:cid/image",
        title: "Pin image",
        description:
          "Pins an asset as the card's primary image. Creates the card if the chapter does not have one yet.",
        scopes: ["storyboard:write"],
        body: { asset_id: ASSET.id },
        response: { data: STORY_CARD },
      },
      {
        id: "unpin-storyboard-image",
        method: "DELETE",
        path: "/api/v1/projects/:id/storyboard/:cid/image",
        title: "Unpin image",
        description: "Clears the primary image without deleting the asset.",
        scopes: ["storyboard:write"],
        response: { data: { chapter_id: CHAPTER.id, primary_image_id: null } },
      },
    ],
  },
  {
    id: "canvases",
    title: "Canvases",
    description:
      "Infinite boards for planning. The API appends discrete elements to `content.elements` and leaves the rest of the editor snapshot intact.",
    endpoints: [
      {
        id: "list-canvases",
        method: "GET",
        path: "/api/v1/projects/:id/canvases",
        title: "List canvases",
        description: "Boards with element counts, most recently updated first.",
        scopes: ["chapters:read"],
        response: {
          data: [
            {
              id: "2b3c4d5e-6f70-4819-a2b3-c4d5e6f70819",
              name: "Act structure",
              thumbnail_url: null,
              element_count: 14,
              created_at: "2026-02-12T10:00:00.000Z",
              updated_at: "2026-03-02T09:30:00.000Z",
            },
          ],
        },
      },
      {
        id: "add-canvas-element",
        method: "POST",
        path: "/api/v1/projects/:id/canvases/:vid/elements",
        title: "Add element",
        description:
          "Appends a note, image, shape or text element. Coordinates are in canvas space; width/height are optional.",
        scopes: ["canvases:write"],
        body: {
          type: "note",
          x: 420,
          y: 180,
          width: 240,
          height: 160,
          text: "What if the town remembers her differently?",
          color: "accent",
        },
        status: 201,
        response: {
          data: {
            id: "5d6e7f80-91a2-4b3c-8d4e-5f60718293a4",
            type: "note",
            x: 420,
            y: 180,
            width: 240,
            height: 160,
            text: "What if the town remembers her differently?",
            asset_id: null,
            url: null,
            color: "accent",
            created_at: "2026-03-02T12:10:00.000Z",
          },
          canvas_id: "2b3c4d5e-6f70-4819-a2b3-c4d5e6f70819",
          element_count: 15,
        },
        notes: ["`asset_id`, when supplied, must belong to the same project."],
      },
    ],
  },
  {
    id: "exports",
    title: "Exports",
    description:
      "Exports are asynchronous. `POST` enqueues a job and returns immediately; poll until `status` is `done` or `failed`. Completed jobs include a public `download_url`.",
    endpoints: [
      {
        id: "create-export",
        method: "POST",
        path: "/api/v1/projects/:id/export",
        title: "Create export job",
        description:
          "Enqueues an export. Formats: `epub`, `pdf`, `pdf_screen`, `docx`, `markdown`, `html`, `json`. Responds `202 Accepted`.",
        scopes: ["exports:write"],
        body: {
          format: "epub",
          style_template: "literary",
          scope: "project",
          options: { include_front_matter: true },
        },
        status: 202,
        response: { data: EXPORT_JOB },
        notes: [
          "Set `scope` to `chapter` and provide `chapter_id` to export a single chapter.",
          "Generation is asynchronous: poll the job until `status` is `done` or `failed`. A queued job is claimed by the export worker, or by the poll endpoint when no worker is running.",
          "`export.completed` is emitted when the file exists and `download_url` is set.",
        ],
      },
      {
        id: "get-export",
        method: "GET",
        path: "/api/v1/exports/:jobId",
        title: "Get export job",
        description: "Polls a job. When `status` is `done`, `download_url` points at the generated file.",
        scopes: ["projects:read"],
        response: {
          data: {
            ...EXPORT_JOB,
            status: "done",
            progress: 100,
            download_url: "https://<project>.supabase.co/storage/v1/object/public/exports/2026-03-02/the-salt-road.epub",
            size_bytes: 1843200,
            started_at: "2026-03-02T12:00:03.000Z",
            completed_at: "2026-03-02T12:00:18.000Z",
          },
        },
      },
    ],
  },
  {
    id: "ai",
    title: "AI",
    description:
      "Proxied AI actions using the server's configured provider (Anthropic, OpenAI-compatible, or the offline local draft when no key is set). Results are marked with the provider that answered.",
    endpoints: [
      {
        id: "ai-generate",
        method: "POST",
        path: "/api/v1/projects/:id/ai/generate",
        title: "Generate text",
        description:
          "Runs one editorial action. Supply `selection` (text to act on) or `prompt`. Including `chapter_id` adds the chapter's title, synopsis and first 6,000 characters of content as context.",
        scopes: ["ai:write"],
        body: {
          action: "continue",
          prompt: "Continue the scene at the survey marker.",
          chapter_id: CHAPTER.id,
          model: "claude",
        },
        response: {
          data: {
            text: "The wind came off the flats with nothing to slow it…",
            model: "claude-sonnet-4-5",
            provider: "anthropic",
            usage: { input_tokens: 1830, output_tokens: 210 },
          },
        },
        notes: [
          "Actions: `rephrase`, `improve`, `expand`, `shorten`, `tone`, `translate`, `summarise`, `continue`, `outline`, `chat`.",
          "`target` carries the tone or language name for `tone` and `translate`.",
          "Inputs are capped at 20,000 characters.",
          "With no provider key configured, `provider` is `offline` and the text is a clearly marked local draft.",
        ],
      },
      {
        id: "ai-image",
        method: "POST",
        path: "/api/v1/projects/:id/ai/image",
        title: "Generate image",
        description:
          "Generates an image from a prompt and stores it in the project asset library (`source: \"ai\"`). Requires an image-capable OpenAI key on the server.",
        scopes: ["ai:write"],
        body: { prompt: "Cover art: a salt road at dusk, painterly, muted ochre", size: "1024x1536" },
        status: 201,
        response: {
          data: {
            ...ASSET,
            filename: "cover-art-a-salt-road-at-dusk-painterly-muted-ochre.png",
            source: "ai",
            tags: ["ai-generated"],
          },
          model: "gpt-image-1",
        },
        notes: [
          "Returns `501 image_provider_unavailable` when `OPENAI_API_KEY` is not configured. Images are never fabricated.",
        ],
      },
    ],
  },
];

export const ERROR_CODES: { code: string; status: string; meaning: string }[] = [
  { code: "unauthorized", status: "401", meaning: "No Authorization header, or it is not `Bearer ink_live_…`." },
  { code: "invalid_key", status: "401", meaning: "The key is unknown or has been revoked." },
  { code: "insufficient_scope", status: "403", meaning: "The key lacks a scope required by the route." },
  { code: "forbidden", status: "403", meaning: "The workspace has read-only access, or the action is owner-only." },
  { code: "not_found", status: "404", meaning: "No such resource, or the key cannot see it (existence is not leaked)." },
  { code: "validation_error", status: "400 / 415 / 422", meaning: "Malformed JSON, unsupported media type, or a body/query that failed validation." },
  { code: "rate_limited", status: "429", meaning: "The per-key token bucket is empty. Respect `Retry-After`." },
  { code: "internal_error", status: "500", meaning: "Unexpected server error. Quote `X-Request-Id` when reporting it." },
  { code: "provider_unavailable", status: "501 / 503", meaning: "The requested AI capability is not configured (`image_provider_unavailable` for images)." },
];

export const SCOPE_TABLE: { scope: string; grants: string }[] = [
  { scope: "projects:read", grants: "List and read projects; poll export jobs." },
  { scope: "projects:write", grants: "Create, update and delete projects." },
  { scope: "chapters:read", grants: "Read chapters, the storyboard and canvases." },
  { scope: "chapters:write", grants: "Create, edit, delete and reorder chapters and blocks." },
  { scope: "assets:read", grants: "List the asset library." },
  { scope: "assets:write", grants: "Upload and delete assets." },
  { scope: "storyboard:write", grants: "Pin and unpin storyboard images." },
  { scope: "canvases:write", grants: "Add elements to canvases." },
  { scope: "exports:write", grants: "Trigger exports." },
  { scope: "ai:write", grants: "Generate text and images with the workspace provider." },
];

export const WEBHOOK_EVENTS_DOC: {
  event: string;
  description: string;
  payload: Record<string, unknown>;
}[] = [
  {
    event: "chapter.created",
    description: "A chapter or section was created.",
    payload: {
      id: "evt_7f3a",
      event: "chapter.created",
      project_id: PROJECT.id,
      created_at: "2026-03-02T12:00:00.000Z",
      data: {
        id: CHAPTER.id,
        title: "Chapter Two — Instruments",
        parent_id: null,
        position: 1,
        status: "draft",
        word_count: 0,
      },
    },
  },
  {
    event: "chapter.updated",
    description: "Body, title, status or ordering changed. Includes `operation` for content edits.",
    payload: {
      id: "evt_8a4b",
      event: "chapter.updated",
      project_id: PROJECT.id,
      created_at: "2026-03-02T12:01:00.000Z",
      data: { id: CHAPTER.id, title: "Chapter One — The survey", word_count: 3198, operation: "append" },
    },
  },
  {
    event: "chapter.deleted",
    description: "A chapter was deleted.",
    payload: {
      id: "evt_9b5c",
      event: "chapter.deleted",
      project_id: PROJECT.id,
      created_at: "2026-03-02T12:02:00.000Z",
      data: { id: CHAPTER.id, title: "Chapter One — The survey", parent_id: null },
    },
  },
  {
    event: "asset.uploaded",
    description: "An image or file was added, including AI-generated images.",
    payload: {
      id: "evt_0c6d",
      event: "asset.uploaded",
      project_id: PROJECT.id,
      created_at: "2026-03-02T12:03:00.000Z",
      data: {
        id: ASSET.id,
        filename: "salt-flats.png",
        url: ASSET.url,
        mime_type: "image/png",
        size_bytes: 184320,
      },
    },
  },
  {
    event: "export.completed",
    description: "An export finished. `data.download_url` is ready to use.",
    payload: {
      id: "evt_1d7e",
      event: "export.completed",
      project_id: PROJECT.id,
      created_at: "2026-03-02T12:04:00.000Z",
      data: { job_id: EXPORT_JOB.id, format: "epub", download_url: "https://…/the-salt-road.epub", size_bytes: 1843200 },
    },
  },
  {
    event: "comment.created",
    description: "A reviewer left a comment (including replies).",
    payload: {
      id: "evt_2e8f",
      event: "comment.created",
      project_id: PROJECT.id,
      created_at: "2026-03-02T12:05:00.000Z",
      data: {
        id: "4a5b6c7d-8e9f-4a0b-9c1d-2e3f4a5b6c7d",
        chapter_id: CHAPTER.id,
        author_id: "1f2e3d4c-5b6a-4978-8a9b-0c1d2e3f4a5b",
        body: "The instruments beat is doing too much work here.",
        resolved: false,
      },
    },
  },
  {
    event: "project.updated",
    description: "Project metadata changed.",
    payload: {
      id: "evt_3f90",
      event: "project.updated",
      project_id: PROJECT.id,
      created_at: "2026-03-02T12:06:00.000Z",
      data: { id: PROJECT.id, fields: ["title", "status"] },
    },
  },
];

export const SIGNATURE_SNIPPET_NODE = `import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyInkwellSignature(rawBody: string, header: string, secret: string) {
  const received = header.replace(/^sha256=/, "");
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(received, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// Express / Next route handler — verify against the RAW body, before JSON.parse.
const ok = verifyInkwellSignature(raw, req.headers["x-inkwell-signature"] ?? "", process.env.INKWELL_WEBHOOK_SECRET!);
if (!ok) return new Response("bad signature", { status: 401 });`;

export const SIGNATURE_SNIPPET_PY = `import hashlib, hmac

def verify(raw_body: bytes, header: str, secret: str) -> bool:
    received = header.removeprefix("sha256=")
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(received, expected)`;

export const CURL_QUICKSTART = `# 1. create a key in Settings → API, then:
export INKWELL_KEY="ink_live_…"

# 2. list projects
curl https://your-domain.com/api/v1/projects \\
  -H "Authorization: Bearer $INKWELL_KEY"

# 3. read a chapter as Markdown (ideal for prompts)
curl "https://your-domain.com/api/v1/projects/$PROJECT_ID/chapters/$CHAPTER_ID?format=md" \\
  -H "Authorization: Bearer $INKWELL_KEY"

# 4. append a paragraph
curl -X POST "https://your-domain.com/api/v1/projects/$PROJECT_ID/chapters/$CHAPTER_ID/append" \\
  -H "Authorization: Bearer $INKWELL_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"text":"The road came back before the town did."}'`;
