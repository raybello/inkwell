/** Shared webhook constants and client-safe types. */

export const WEBHOOK_EVENTS = [
  "chapter.created",
  "chapter.updated",
  "chapter.deleted",
  "asset.uploaded",
  "export.completed",
  "comment.created",
  "project.updated",
] as const;

export type WebhookEventName = (typeof WEBHOOK_EVENTS)[number];

export const WEBHOOK_EVENT_DESCRIPTIONS: Record<WebhookEventName, string> = {
  "chapter.created": "A chapter or section was created.",
  "chapter.updated": "Title, body, status or ordering changed.",
  "chapter.deleted": "A chapter was removed.",
  "asset.uploaded": "An image or file was added to the asset library.",
  "export.completed": "An export job finished and a download URL exists.",
  "comment.created": "A reviewer left a comment.",
  "project.updated": "Project metadata changed.",
};

export interface WebhookDeliveryView {
  id: string;
  webhook_id: string;
  event: string;
  status_code: number | null;
  ok: boolean;
  attempts: number;
  error: string | null;
  created_at: string;
  payload: Record<string, unknown> | null;
}
