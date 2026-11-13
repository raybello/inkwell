/**
 * Transactional email — Resend over plain `fetch`.
 *
 * The Resend SDK is not installed, and the app must work without credentials.
 * When `RESEND_API_KEY` is absent every send is a no-op that reports
 * `{ sent: false, reason: "email_not_configured" }`. Callers must surface that
 * honestly instead of claiming an email went out.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM = "Inkwell Studio <onboarding@resend.dev>";

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  /** Optional Reply-To, e.g. the collaborator who sent an invite. */
  replyTo?: string;
  /** Optional per-message override of EMAIL_FROM. */
  from?: string;
}

export type SendEmailResult =
  | { sent: true; id: string }
  | { sent: false; reason: "email_not_configured" | "invalid_recipient" | "provider_error"; error?: string };

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function emailFromAddress(): string {
  return process.env.EMAIL_FROM?.trim() || DEFAULT_FROM;
}

function normaliseRecipients(to: string | string[]): string[] {
  return (Array.isArray(to) ? to : [to]).map((r) => r.trim()).filter(Boolean);
}

/**
 * Send one email. Never throws — a failed notification must not take down the
 * action that triggered it.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const recipients = normaliseRecipients(input.to);
  if (recipients.length === 0) {
    return { sent: false, reason: "invalid_recipient" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = input.from?.trim() || emailFromAddress();

  if (!apiKey) {
    console.info(
      `[email] not configured — skipped "${input.subject}" to ${recipients.join(", ")}. ` +
        "Set RESEND_API_KEY to enable delivery.",
    );
    return { sent: false, reason: "email_not_configured" };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: input.subject,
        html: input.html,
        ...(input.text ? { text: input.text } : {}),
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
      cache: "no-store",
    });

    const payload = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;

    if (!res.ok) {
      console.error(`[email] Resend rejected "${input.subject}" (${res.status}): ${payload?.message ?? "unknown error"}`);
      return { sent: false, reason: "provider_error", error: payload?.message ?? `HTTP ${res.status}` };
    }

    return { sent: true, id: payload?.id ?? "" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "network error";
    console.error(`[email] send failed: ${message}`);
    return { sent: false, reason: "provider_error", error: message };
  }
}

/* ------------------------------------------------------------------ layout */

/** Subjects are headers, not HTML: strip newlines so names can't break them. */
function headerSafe(value: string): string {
  return value.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 200);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

interface LayoutInput {
  preheader: string;
  heading: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
  footnote?: string;
}

/** Warm paper email shell. Inline styles only — email clients ignore stylesheets. */
function renderLayout({ preheader, heading, paragraphs, cta, footnote }: LayoutInput): string {
  const body = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3a332b;">${p}</p>`,
    )
    .join("");

  const button = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
         <tr><td style="border-radius:8px;background:#c8814a;">
           <a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:11px 20px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#1a1611;text-decoration:none;border-radius:8px;">${escapeHtml(cta.label)}</a>
         </td></tr>
       </table>
       <p style="margin:0 0 16px;font-size:12px;line-height:1.5;color:#7a6b5b;word-break:break-all;">
         Or paste this link into your browser:<br />
         <a href="${escapeHtml(cta.url)}" style="color:#9c5f31;">${escapeHtml(cta.url)}</a>
       </p>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f2ece1;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2ece1;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffdf8;border:1px solid #e3d9c9;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px 8px;border-bottom:1px solid #efe6d9;">
                <span style="font-family:Georgia,'Times New Roman',serif;font-size:17px;letter-spacing:-0.01em;color:#211d18;">Inkwell Studio</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:23px;line-height:1.25;font-weight:600;color:#211d18;">${escapeHtml(heading)}</h1>
                ${body}
                ${button}
                ${footnote ? `<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #efe6d9;font-size:12px;line-height:1.6;color:#7a6b5b;">${footnote}</p>` : ""}
              </td>
            </tr>
          </table>
          <p style="max-width:560px;margin:14px auto 0;font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#91806d;text-align:center;">
            Sent by Inkwell Studio. If you weren't expecting this, you can ignore it.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function toPlainText(paragraphs: string[], cta?: { label: string; url: string }): string {
  const lines = paragraphs.map((p) => p.replace(/<[^>]+>/g, ""));
  if (cta) lines.push("", `${cta.label}: ${cta.url}`);
  return lines.join("\n\n");
}

/* --------------------------------------------------------------- templates */

export interface CollaboratorInviteInput {
  inviterName: string;
  projectTitle: string;
  role: string;
  /** Absolute URL that accepts the invite. */
  acceptUrl: string;
  /** Optional personal note from the inviter. */
  message?: string;
}

export function collaboratorInviteEmail({
  inviterName,
  projectTitle,
  role,
  acceptUrl,
  message,
}: CollaboratorInviteInput): RenderedEmail {
  const subject = headerSafe(`${inviterName} invited you to “${projectTitle}” on Inkwell`);
  const paragraphs = [
    `<strong>${escapeHtml(inviterName)}</strong> invited you to collaborate on <strong>${escapeHtml(projectTitle)}</strong> as ${escapeHtml(role)}.`,
    ...(message ? [`“${escapeHtml(message)}”`] : []),
    "Inkwell keeps chapters, notes, storyboard and exports in one place, so you can review and write in the same room.",
  ];
  const cta = { label: "Open the project", url: acceptUrl };
  return {
    subject,
    html: renderLayout({
      preheader: `${inviterName} invited you to ${projectTitle} as ${role}.`,
      heading: "You've been invited to write",
      paragraphs,
      cta,
      footnote: "The invite link signs you in with this email address. If you don't have an Inkwell account yet, you'll be asked to create one.",
    }),
    text: toPlainText(paragraphs, cta),
  };
}

export interface ExportReadyInput {
  projectTitle: string;
  format: string;
  downloadUrl: string;
  /** Optional human-readable size, e.g. "2.4 MB". */
  size?: string;
  /** Optional ISO timestamp after which the link stops working. */
  expiresAt?: string | null;
}

export function exportReadyEmail({
  projectTitle,
  format,
  downloadUrl,
  size,
  expiresAt,
}: ExportReadyInput): RenderedEmail {
  const subject = headerSafe(`Your ${format.toUpperCase()} export of “${projectTitle}” is ready`);
  const meta = [format.toUpperCase(), size].filter(Boolean).join(" · ");
  const expires = expiresAt
    ? `The link expires ${new Date(expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`
    : "The link stays available while the project exists.";

  const paragraphs = [
    `<strong>${escapeHtml(projectTitle)}</strong> finished exporting (${escapeHtml(meta)}).`,
    "Download it below — the file is also listed on the project's export page.",
  ];
  const cta = { label: `Download ${format.toUpperCase()}`, url: downloadUrl };
  return {
    subject,
    html: renderLayout({
      preheader: `${projectTitle} — ${meta} ready to download.`,
      heading: "Your export is ready",
      paragraphs,
      cta,
      footnote: escapeHtml(expires),
    }),
    text: toPlainText(paragraphs, cta),
  };
}

export interface CommentNotificationInput {
  actorName: string;
  projectTitle: string;
  chapterTitle: string;
  /** Comment body, plain text or simple HTML. */
  body: string;
  /** Absolute URL to the comment thread. */
  url: string;
  /** True when the comment replies to an existing thread. */
  isReply?: boolean;
}

export function commentNotificationEmail({
  actorName,
  projectTitle,
  chapterTitle,
  body,
  url,
  isReply,
}: CommentNotificationInput): RenderedEmail {
  const subject = headerSafe(`${actorName} ${isReply ? "replied" : "commented"} on “${chapterTitle}”`);
  const excerpt = body.length > 600 ? `${body.slice(0, 597).trimEnd()}…` : body;
  const paragraphs = [
    `<strong>${escapeHtml(actorName)}</strong> ${isReply ? "replied" : "left a comment"} in <strong>${escapeHtml(chapterTitle)}</strong> — ${escapeHtml(projectTitle)}.`,
    `<span style="display:block;margin:4px 0;padding:12px 14px;border-left:3px solid #c8814a;background:#f7f2e8;color:#3a332b;">${escapeHtml(excerpt)}</span>`,
  ];
  const cta = { label: "Read and reply", url };
  return {
    subject,
    html: renderLayout({
      preheader: `${actorName} on ${chapterTitle}: ${excerpt.slice(0, 90)}`,
      heading: "A note on your draft",
      paragraphs,
      cta,
      footnote: "You're receiving this because you're a collaborator on this project. Comment notifications can be turned off in project settings.",
    }),
    text: toPlainText(paragraphs, cta),
  };
}
