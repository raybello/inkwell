import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { markdownToTiptap, tiptapToHtml } from "@/lib/markdown";
import { normalizeSceneBreaks, parseHtml, serializeNodes, stripLeadingTitleHeading, type HtmlNode } from "@/lib/export/html-parse";
import { ShareReader, type ShareChapter } from "@/components/preview/share-reader";
import type { Chapter, Project, ShareLink } from "@/lib/types";
import type { StyleName } from "@/lib/export/types";

export const dynamic = "force-dynamic";

const TOKEN = /^[A-Za-z0-9_-]{8,80}$/;
const SAFE_SCHEME = /^(https?:|mailto:|#|\/)/i;

interface SharePayload {
  project: Project;
  chapters: Chapter[];
  author: string;
  theme: StyleName;
  chapterScoped: boolean;
}

function safeHref(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^javascript:/i.test(trimmed) || /^data:text\/html/i.test(trimmed)) return null;
  return trimmed;
}

/** Strip active content and unsafe URLs from user-authored chapter HTML before publishing it. */
function sanitizePublicHtml(html: string): string {
  const nodes = parseHtml(html);
  const walk = (list: HtmlNode[]) => {
    for (const node of list) {
      if (node.type !== "element") continue;
      if (["script", "style", "iframe", "object", "embed", "form", "input", "button", "svg"].includes(node.tag)) {
        node.tag = "span";
        node.children = [];
        node.attrs = {};
        continue;
      }
      if (node.tag === "a" && node.attrs.href) {
        const href = safeHref(node.attrs.href);
        if (!href || !SAFE_SCHEME.test(href)) delete node.attrs.href;
        else node.attrs.href = href;
      }
      if (node.tag === "img" && node.attrs.src) {
        const src = safeHref(node.attrs.src);
        if (!src || !/^(https?:|data:image\/)/i.test(src)) delete node.attrs.src;
      }
      walk(node.children);
    }
  };
  walk(nodes);
  return serializeNodes(nodes, {});
}

function renderChapterHtml(chapter: Chapter): string {
  let html = "";
  try {
    html = tiptapToHtml(chapter.content);
  } catch {
    html = "";
  }
  if (!html.trim() && chapter.content_md) {
    html = tiptapToHtml(markdownToTiptap(chapter.content_md));
  }
  return sanitizePublicHtml(normalizeSceneBreaks(stripLeadingTitleHeading(html, chapter.title)));
}

/**
 * Resolve a share token to a readable book.
 *
 * Capability model: a valid, enabled `share_links.token` grants read access on
 * its own. `chapters` has no anonymous RLS policy, so once the token is verified
 * we deliberately switch to the service client to read the content. The
 * project-level `share_token` (written by the Share button) is also supported
 * when `is_public` is true. Disabled links resolve to nothing.
 */
const loadShare = cache(async (token: string): Promise<SharePayload | null> => {
  if (!TOKEN.test(token)) return null;
  const supabase = await createClient();

  let link: ShareLink | null = null;
  const viaSession = await supabase.from("share_links").select("*").eq("token", token).eq("enabled", true).maybeSingle();
  if (viaSession.data) link = viaSession.data as ShareLink;

  if (!link) {
    // Fallback for deployments where the anonymous select policy on
    // `share_links` is missing or has been tightened.
    const admin = createAdminClient();
    const { data } = await admin.from("share_links").select("*").eq("token", token).eq("enabled", true).maybeSingle();
    if (data) link = data as ShareLink;
  }

  let project: Project | null = null;
  if (link) {
    // Re-verify the capability before bypassing RLS.
    if (link.token !== token || !link.enabled) return null;
    const admin = createAdminClient();
    const { data } = await admin.from("projects").select("*").eq("id", link.project_id).maybeSingle();
    project = (data as Project | null) ?? null;
  }

  if (!project) {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("share_token", token)
      .eq("is_public", true)
      .maybeSingle();
    project = (data as Project | null) ?? null;
    if (!project) {
      const admin = createAdminClient();
      const { data: fallback } = await admin
        .from("projects")
        .select("*")
        .eq("share_token", token)
        .eq("is_public", true)
        .maybeSingle();
      project = (fallback as Project | null) ?? null;
    }
  }

  if (!project) return null;
  if (link && project.id !== link.project_id) return null;
  if (!link && !(project.share_token === token && project.is_public)) return null;

  // Try the anonymous RLS path first; chapters only become readable via an
  // enabled share link, so the verified capability justifies the service-client
  // fallback when RLS returns nothing.
  const sessionRead = await supabase
    .from("chapters")
    .select("*")
    .eq("project_id", project.id)
    .order("position", { ascending: true });
  let allChapters = (sessionRead.data ?? []) as Chapter[];
  if (!allChapters.length) {
    const admin = createAdminClient();
    const { data: chapterRows } = await admin
      .from("chapters")
      .select("*")
      .eq("project_id", project.id)
      .order("position", { ascending: true });
    allChapters = (chapterRows ?? []) as Chapter[];
  }

  const chapterScoped = link?.mode === "chapter";
  const chapters = chapterScoped
    ? allChapters.filter((chapter) => chapter.id === link?.chapter_id)
    : allChapters;

  if (!chapters.length) return null;

  const admin = createAdminClient();
  const { data: owner } = await admin.from("profiles").select("display_name").eq("id", project.owner_id).maybeSingle();
  const settingsAuthor = project.settings && typeof project.settings === "object" ? project.settings.author : null;
  const author =
    (typeof settingsAuthor === "string" && settingsAuthor.trim()) ||
    (typeof owner?.display_name === "string" && owner.display_name.trim()) ||
    "";

  const theme: StyleName = link?.theme === "modern" || link?.theme === "minimal" ? link.theme : "literary";

  return { project, chapters, author, theme, chapterScoped };
});

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const data = await loadShare(token);
  if (!data) {
    return { title: "Reading copy unavailable", robots: { index: false, follow: false } };
  }
  const description = data.project.description ?? `${data.project.title}${data.author ? ` by ${data.author}` : ""} — a reading copy from Inkwell Studio.`;
  return {
    title: data.project.title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title: data.project.title,
      description,
      type: "article",
      images: data.project.cover_image_url ? [data.project.cover_image_url] : undefined,
    },
    twitter: {
      card: data.project.cover_image_url ? "summary_large_image" : "summary",
      title: data.project.title,
      description,
    },
  };
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await loadShare(token);
  if (!data) notFound();

  const chapters: ShareChapter[] = data.chapters.map((chapter) => ({
    id: chapter.id,
    title: chapter.title,
    synopsis: chapter.synopsis,
    html: renderChapterHtml(chapter),
    wordCount: chapter.word_count,
  }));

  return (
    <ShareReader
      project={{
        title: data.project.title,
        subtitle: data.project.subtitle,
        author: data.author,
        description: data.project.description,
        genre: data.project.genre,
        coverUrl: data.project.cover_image_url,
      }}
      chapters={chapters}
      theme={data.theme}
      chapterScoped={data.chapterScoped}
    />
  );
}
