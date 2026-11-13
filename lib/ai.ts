/**
 * Provider abstraction for Inkwell's AI features.
 *
 * Supported providers:
 *  - Anthropic   (ANTHROPIC_API_KEY)
 *  - OpenAI-compatible chat + images (OPENAI_API_KEY, optional OPENAI_BASE_URL)
 *  - Deterministic offline fallback (no key configured) — clearly marked output so
 *    the editor UI works in local development without fabricating real AI results.
 *
 * All functions return the model that actually answered so callers can badge an
 * "offline" result in the UI.
 */

export type AiAction =
  | "rephrase"
  | "improve"
  | "expand"
  | "shorten"
  | "tone"
  | "translate"
  | "summarise"
  | "continue"
  | "outline"
  | "chat";

export type AiProvider = "anthropic" | "openai" | "offline";

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiUsage {
  input_tokens?: number;
  output_tokens?: number;
}

export interface AiResult {
  text: string;
  model: string;
  provider: AiProvider;
  usage?: AiUsage;
}

export interface AiContext {
  projectTitle?: string;
  chapterTitle?: string;
  synopsis?: string;
  excerpt?: string;
}

export interface GenerateInput {
  action: AiAction;
  selection?: string;
  prompt?: string;
  target?: string;
  context?: AiContext;
  model?: string;
}

export class AiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 502, code = "ai_provider_error") {
    super(message);
    this.name = "AiError";
    this.status = status;
    this.code = code;
  }
}

const DEFAULT_MODELS = {
  anthropic: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
  openai: process.env.OPENAI_MODEL || "gpt-4o-mini",
  image: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
};

const OFFLINE_MODEL = "inkwell-local-draft";

export const ACTION_LABELS: Record<AiAction, string> = {
  rephrase: "Rephrase",
  improve: "Improve",
  expand: "Expand",
  shorten: "Shorten",
  tone: "Change tone",
  translate: "Translate",
  summarise: "Summarise",
  continue: "Continue",
  outline: "Outline",
  chat: "Chat",
};

/* ------------------------------------------------------------------ helpers */

function apiKey(provider: "anthropic" | "openai"): string | null {
  const value = provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;
  return value && value.trim() && !value.startsWith("your-") ? value.trim() : null;
}

const OPENAI_BASE = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");

type Json = Record<string, unknown>;

function asRecord(value: unknown): Json | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Json) : null;
}

function pickString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function pickNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Which provider should serve this request? Explicit model wins, then env, then availability. */
export function resolveProvider(model?: string): AiProvider {
  const alias = (model ?? process.env.AI_DEFAULT_MODEL ?? "").toLowerCase();
  const hasAnthropic = Boolean(apiKey("anthropic"));
  const hasOpenAI = Boolean(apiKey("openai"));

  if (alias.startsWith("claude")) return hasAnthropic ? "anthropic" : "offline";
  if (alias.startsWith("gpt") || alias.startsWith("o1") || alias.startsWith("o3") || alias === "openai")
    return hasOpenAI ? "openai" : "offline";
  if (alias === "offline" || alias === "local") return "offline";

  if (hasAnthropic) return "anthropic";
  if (hasOpenAI) return "openai";
  return "offline";
}

function modelFor(provider: "anthropic" | "openai", requested?: string): string {
  const value = requested?.trim();
  if (value && !["claude", "gpt", "openai"].includes(value.toLowerCase())) return value;
  return provider === "anthropic" ? DEFAULT_MODELS.anthropic : DEFAULT_MODELS.openai;
}

function actionInstruction(action: AiAction, target?: string): string {
  switch (action) {
    case "rephrase":
      return "Rewrite the passage in fresh wording while preserving meaning, voice and tense.";
    case "improve":
      return "Line-edit the passage: tighten syntax, sharpen verbs, keep the author's voice and the facts.";
    case "expand":
      return "Expand the passage with concrete sensory detail and interiority. Roughly 1.5–2× the original length. Do not invent plot events.";
    case "shorten":
      return "Cut the passage to its strongest core, roughly half the length, without losing meaning.";
    case "tone":
      return `Rewrite the passage in a ${target || "literary"} tone. Keep the meaning and any names or facts.`;
    case "translate":
      return `Translate the passage into ${target || "Spanish"}. Preserve line breaks and markdown. Output only the translation.`;
    case "summarise":
      return "Summarise the passage as a tight synopsis of 2–4 sentences, present tense, no spoilers beyond the text.";
    case "continue":
      return "Continue the passage for 2–3 paragraphs in the same voice, tense and point of view. Do not summarise what came before.";
    case "outline":
      return "Produce a chapter outline from the premise. Numbered list: chapter title, one-line summary, and a beat list of 2–3 items. 6–10 chapters.";
    case "chat":
      return "Answer the writer's message using the manuscript context. Be concise and practical.";
    default:
      return "Help the writer with the passage.";
  }
}

const SYSTEM_PROMPT =
  "You are Inkwell, an editorial assistant inside a writing studio. You work on fiction and non-fiction manuscripts. " +
  "Return only the requested prose — no preamble, no explanations, no quotation marks around the whole answer. " +
  "Never invent facts about the author's world that are not in the supplied context.";

function contextBlock(context?: AiContext): string {
  if (!context) return "";
  const parts: string[] = [];
  if (context.projectTitle) parts.push(`Project: ${context.projectTitle}`);
  if (context.chapterTitle) parts.push(`Chapter: ${context.chapterTitle}`);
  if (context.synopsis) parts.push(`Synopsis: ${context.synopsis}`);
  if (context.excerpt) parts.push(`Manuscript excerpt:\n${context.excerpt.slice(0, 6000)}`);
  return parts.length ? parts.join("\n") : "";
}

function buildUserPrompt(input: GenerateInput): string {
  const context = contextBlock(input.context);
  const body = input.selection?.trim() || input.prompt?.trim() || "";
  const sections = [
    context ? `CONTEXT\n${context}` : "",
    body ? `PASSAGE\n${body}` : "",
    `INSTRUCTION\n${actionInstruction(input.action, input.target)}`,
  ].filter(Boolean);
  return sections.join("\n\n");
}

/* -------------------------------------------------------------- providers */

async function anthropicComplete(params: {
  model: string;
  system: string;
  messages: AiMessage[];
  maxTokens: number;
  temperature: number;
}): Promise<AiResult> {
  const key = apiKey("anthropic");
  if (!key) throw new AiError("Anthropic is not configured.", 503, "provider_unavailable");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens,
      temperature: params.temperature,
      system: params.system,
      messages: params.messages.map((m) => ({ role: m.role, content: m.content })),
    }),
    signal: AbortSignal.timeout(60_000),
  });

  const payload = asRecord(await response.json().catch(() => null));
  if (!response.ok) {
    const message = pickString(asRecord(payload?.error)?.message) ?? `Anthropic returned HTTP ${response.status}.`;
    throw new AiError(message, response.status === 429 ? 429 : 502, "ai_provider_error");
  }

  const content = Array.isArray(payload?.content) ? payload.content : [];
  const text = content
    .map((block) => pickString(asRecord(block)?.text) ?? "")
    .join("")
    .trim();
  if (!text) throw new AiError("Anthropic returned an empty response.", 502, "ai_empty_response");

  const usage = asRecord(payload?.usage);
  return {
    text,
    model: pickString(payload?.model) ?? params.model,
    provider: "anthropic",
    usage: {
      input_tokens: pickNumber(usage?.input_tokens),
      output_tokens: pickNumber(usage?.output_tokens),
    },
  };
}

async function openaiComplete(params: {
  model: string;
  system: string;
  messages: AiMessage[];
  maxTokens: number;
  temperature: number;
}): Promise<AiResult> {
  const key = apiKey("openai");
  if (!key) throw new AiError("OpenAI is not configured.", 503, "provider_unavailable");

  const response = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens,
      temperature: params.temperature,
      messages: [{ role: "system", content: params.system }, ...params.messages],
    }),
    signal: AbortSignal.timeout(60_000),
  });

  const payload = asRecord(await response.json().catch(() => null));
  if (!response.ok) {
    const message = pickString(asRecord(payload?.error)?.message) ?? `OpenAI returned HTTP ${response.status}.`;
    throw new AiError(message, response.status === 429 ? 429 : 502, "ai_provider_error");
  }

  const choices = Array.isArray(payload?.choices) ? payload.choices : [];
  const text = pickString(asRecord(asRecord(choices[0])?.message)?.content)?.trim() ?? "";
  if (!text) throw new AiError("OpenAI returned an empty response.", 502, "ai_empty_response");

  const usage = asRecord(payload?.usage);
  return {
    text,
    model: pickString(payload?.model) ?? params.model,
    provider: "openai",
    usage: {
      input_tokens: pickNumber(usage?.prompt_tokens),
      output_tokens: pickNumber(usage?.completion_tokens),
    },
  };
}

/* ---------------------------------------------------------------- offline */

function tidy(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\s+([,.!?;:])/g, "$1").trim();
}

function firstSentences(text: string, count: number): string {
  const sentences = tidy(text).match(/[^.!?]+[.!?]+/g) ?? [tidy(text)];
  return sentences
    .slice(0, count)
    .map((sentence) => sentence.trim())
    .join(" ")
    .trim();
}

const OFFLINE_MARKER = "[offline draft — no AI provider configured]";

/** Deterministic local output so the editor works without provider keys. */
export function offlineGenerate(input: GenerateInput): string {
  const source = (input.selection ?? input.prompt ?? "").trim();
  const body = (() => {
    switch (input.action) {
      case "rephrase":
      case "improve": {
        const cleaned = tidy(source)
          .replace(/\bvery\s+/gi, "")
          .replace(/\bin order to\b/gi, "to")
          .replace(/\butilise\b/gi, "use")
          .replace(/\bthat said,\s*/gi, "");
        return cleaned || "The passage was empty, so there was nothing to revise.";
      }
      case "expand": {
        const seed = tidy(source) || "The scene opened on the road.";
        return `${seed}\n\nDust hung in the light and refused to settle. Every sound arrived a half-second late, as though the afternoon itself were thinking.`;
      }
      case "shorten": {
        const sentences = tidy(source).match(/[^.!?]+[.!?]+/g) ?? [];
        if (sentences.length > 1) return sentences.slice(0, Math.max(1, Math.ceil(sentences.length / 2))).join(" ").trim();
        const words = tidy(source).split(" ");
        return words.slice(0, Math.max(1, Math.ceil(words.length / 2))).join(" ");
      }
      case "tone":
        return `${firstSentences(source, 3) || "The passage was empty."} — recast for a ${input.target || "literary"} register in the local draft.`;
      case "translate":
        return `[local draft — translation to ${input.target || "the target language"} requires a provider]\n\n${source}`;
      case "summarise":
        return firstSentences(source, 2) || "Nothing to summarise yet.";
      case "continue": {
        const tail = tidy(source).split(" ").slice(-12).join(" ");
        return `${tail ? `${tail} ` : ""}The next hour passed without ceremony. What had seemed settled began, quietly, to come apart.`;
      }
      case "outline": {
        const premise = tidy(source).split(" ").slice(0, 14).join(" ") || "an unnamed premise";
        return Array.from({ length: 6 }, (_, i) =>
          `${i + 1}. Chapter ${i + 1} — ${["Arrival", "The first friction", "What the letter said", "A door left open", "The cost", "Aftermath"][i]}\n   - Beat: ${premise}${i === 0 ? "" : `, developed further in movement ${i + 1}`}\n   - Beat: a turn the protagonist cannot undo`,
        ).join("\n");
      }
      case "chat":
        return `Local draft: I can see ${input.context?.chapterTitle ? `"${input.context.chapterTitle}"` : "the current chapter"}${input.context?.excerpt ? ` (${input.context.excerpt.trim().split(/\s+/).length} words of context)` : ""}. Configure ANTHROPIC_API_KEY or OPENAI_API_KEY to get a real answer to: "${tidy(source).slice(0, 160)}".`;
      default:
        return tidy(source);
    }
  })();

  return `${body}\n\n${OFFLINE_MARKER}`;
}

/* -------------------------------------------------------------- public API */

export async function generate(input: GenerateInput): Promise<AiResult> {
  const provider = resolveProvider(input.model);
  const userPrompt = buildUserPrompt(input);

  if (provider === "offline") {
    return { text: offlineGenerate(input), model: OFFLINE_MODEL, provider: "offline" };
  }

  const params = {
    model: modelFor(provider, input.model),
    system: SYSTEM_PROMPT,
    messages: [{ role: "user" as const, content: userPrompt }],
    maxTokens: input.action === "outline" ? 1800 : 1200,
    temperature: input.action === "translate" || input.action === "summarise" ? 0.2 : 0.7,
  };

  try {
    return provider === "anthropic" ? await anthropicComplete(params) : await openaiComplete(params);
  } catch (error) {
    if (error instanceof AiError) throw error;
    const message = error instanceof Error ? error.message : "AI request failed";
    throw new AiError(message, 502, "ai_provider_error");
  }
}

export async function chatComplete(params: {
  messages: AiMessage[];
  context?: AiContext;
  model?: string;
}): Promise<AiResult> {
  const provider = resolveProvider(params.model);
  const system = `${SYSTEM_PROMPT}\n\n${contextBlock(params.context)}`.trim();

  if (provider === "offline") {
    const last = [...params.messages].reverse().find((m) => m.role === "user");
    return {
      text: offlineGenerate({ action: "chat", prompt: last?.content ?? "", context: params.context }),
      model: OFFLINE_MODEL,
      provider: "offline",
    };
  }

  const args = {
    model: modelFor(provider, params.model),
    system,
    messages: params.messages,
    maxTokens: 1500,
    temperature: 0.7,
  };

  return provider === "anthropic" ? anthropicComplete(args) : openaiComplete(args);
}

/* --------------------------------------------------------------- streaming */

function sseTextStream(
  body: ReadableStream<Uint8Array>,
  extract: (event: Json) => string | null,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const event = asRecord(JSON.parse(data));
              const text = event ? extract(event) : null;
              if (text) controller.enqueue(encoder.encode(text));
            } catch {
              // Ignore keep-alive / malformed SSE lines; the stream stays open.
            }
          }
        }
      } catch (error) {
        controller.error(error);
        return;
      } finally {
        reader.releaseLock();
      }
      controller.close();
    },
  });
}

function offlineStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chunks = text.match(/\S+\s*/g) ?? [text];
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
        await new Promise((resolve) => setTimeout(resolve, 8));
      }
      controller.close();
    },
  });
}

/**
 * Streams a chat reply as plain text chunks (no SSE framing on the way out).
 * The caller pipes this straight into a Response body.
 */
export async function streamChat(params: {
  messages: AiMessage[];
  context?: AiContext;
  model?: string;
}): Promise<{ stream: ReadableStream<Uint8Array>; model: string; provider: AiProvider }> {
  const provider = resolveProvider(params.model);

  if (provider === "offline") {
    const last = [...params.messages].reverse().find((m) => m.role === "user");
    const text = offlineGenerate({ action: "chat", prompt: last?.content ?? "", context: params.context });
    return { stream: offlineStream(text), model: OFFLINE_MODEL, provider: "offline" };
  }

  const model = modelFor(provider, params.model);
  const system = `${SYSTEM_PROMPT}\n\n${contextBlock(params.context)}`.trim();

  if (provider === "anthropic") {
    const key = apiKey("anthropic");
    if (!key) throw new AiError("Anthropic is not configured.", 503, "provider_unavailable");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        temperature: 0.7,
        system,
        stream: true,
        messages: params.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok || !response.body) {
      const payload = asRecord(await response.json().catch(() => null));
      const message = pickString(asRecord(payload?.error)?.message) ?? `Anthropic returned HTTP ${response.status}.`;
      throw new AiError(message, response.status === 429 ? 429 : 502, "ai_provider_error");
    }

    const stream = sseTextStream(response.body, (event) => {
      if (event.type !== "content_block_delta") return null;
      const delta = asRecord(event.delta);
      return pickString(delta?.text) ?? null;
    });
    return { stream, model, provider };
  }

  const key = apiKey("openai");
  if (!key) throw new AiError("OpenAI is not configured.", 503, "provider_unavailable");
  const response = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      temperature: 0.7,
      stream: true,
      messages: [{ role: "system", content: system }, ...params.messages],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok || !response.body) {
    const payload = asRecord(await response.json().catch(() => null));
    const message = pickString(asRecord(payload?.error)?.message) ?? `OpenAI returned HTTP ${response.status}.`;
    throw new AiError(message, response.status === 429 ? 429 : 502, "ai_provider_error");
  }

  const stream = sseTextStream(response.body, (event) => {
    const choices = Array.isArray(event.choices) ? event.choices : [];
    const delta = asRecord(asRecord(choices[0])?.delta);
    return pickString(delta?.content) ?? null;
  });
  return { stream, model, provider };
}

/* ----------------------------------------------------------------- images */

export interface AiImageResult {
  bytes: Uint8Array;
  mimeType: string;
  model: string;
}

export function imageGenerationAvailable(): boolean {
  return Boolean(apiKey("openai"));
}

/**
 * Generates an image with OpenAI's Images API. Returns raw bytes so the caller
 * can store them in the project asset library. Throws a 501 `AiError` when no
 * image provider is configured — images are never fabricated.
 */
export async function generateImage(params: {
  prompt: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  model?: string;
}): Promise<AiImageResult> {
  const key = apiKey("openai");
  if (!key) {
    throw new AiError(
      "Image generation requires OPENAI_API_KEY. Configure it on the server, then retry.",
      501,
      "image_provider_unavailable",
    );
  }

  const model = params.model?.trim() || DEFAULT_MODELS.image;
  const response = await fetch(`${OPENAI_BASE}/images/generations`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      prompt: params.prompt,
      n: 1,
      size: params.size ?? "1024x1024",
    }),
    signal: AbortSignal.timeout(120_000),
  });

  const payload = asRecord(await response.json().catch(() => null));
  if (!response.ok) {
    const message = pickString(asRecord(payload?.error)?.message) ?? `OpenAI returned HTTP ${response.status}.`;
    throw new AiError(message, response.status === 429 ? 429 : 502, "ai_provider_error");
  }

  const first = Array.isArray(payload?.data) ? asRecord(payload.data[0]) : null;
  const b64 = pickString(first?.b64_json);
  const url = pickString(first?.url);

  if (b64) {
    return { bytes: Buffer.from(b64, "base64"), mimeType: "image/png", model };
  }

  if (url) {
    const imageResponse = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!imageResponse.ok) throw new AiError("Generated image could not be downloaded.", 502, "ai_provider_error");
    const mimeType = imageResponse.headers.get("content-type")?.split(";")[0] || "image/png";
    return { bytes: new Uint8Array(await imageResponse.arrayBuffer()), mimeType, model };
  }

  throw new AiError("Image provider returned no image data.", 502, "ai_empty_response");
}
