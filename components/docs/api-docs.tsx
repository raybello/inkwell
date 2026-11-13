"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CURL_QUICKSTART,
  ENDPOINT_SECTIONS,
  ERROR_CODES,
  SCOPE_TABLE,
  SIGNATURE_SNIPPET_NODE,
  SIGNATURE_SNIPPET_PY,
  WEBHOOK_EVENTS_DOC,
  type DocEndpoint,
  type HttpMethod,
} from "@/components/docs/api-endpoints";

const METHOD_STYLES: Record<HttpMethod, string> = {
  GET: "border-sage/40 bg-sage/15 text-sage",
  POST: "border-accent/40 bg-accent/15 text-accent-soft",
  PATCH: "border-amber-700/50 bg-amber-800/20 text-amber-300",
  DELETE: "border-red-800/50 bg-red-900/25 text-red-300",
};

const GUIDE = [
  { id: "quickstart", title: "Quickstart" },
  { id: "conventions", title: "Conventions" },
  { id: "authentication", title: "Authentication" },
  { id: "rate-limits", title: "Rate limits" },
  { id: "errors", title: "Errors" },
  { id: "webhooks", title: "Webhooks" },
  { id: "signatures", title: "Verifying signatures" },
];

function MethodPill({ method, className }: { method: HttpMethod | string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-14 shrink-0 justify-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide",
        METHOD_STYLES[method as HttpMethod] ?? METHOD_STYLES.GET,
        className,
      )}
    >
      {method}
    </span>
  );
}

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      aria-label={label}
      className="inline-flex items-center gap-1 rounded border border-border-strong bg-ink-900/80 px-1.5 py-1 text-[10px] text-muted transition hover:border-accent/40 hover:text-foreground"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}

function CodeBlock({
  code,
  label,
  tone = "default",
}: {
  code: string;
  label?: string;
  tone?: "default" | "response";
}) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-ink-950/70">
      {label && (
        <div className="flex items-center justify-between border-b border-border/80 px-3 py-1.5">
          <span className="text-[10px] uppercase tracking-[0.16em] text-muted">{label}</span>
          <CopyButton value={code} />
        </div>
      )}
      <pre
        className={cn(
          "overflow-x-auto p-3 font-mono text-[11.5px] leading-relaxed",
          tone === "response" ? "text-ink-200" : "text-ink-100",
        )}
      >
        <code>{code}</code>
      </pre>
      {!label && (
        <div className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100">
          <CopyButton value={code} />
        </div>
      )}
    </div>
  );
}

function SectionHeading({
  id,
  title,
  eyebrow,
  description,
}: {
  id: string;
  title: string;
  eyebrow?: string;
  description?: string;
}) {
  return (
    <div id={id} data-doc-id={id} className="scroll-mt-24 border-t border-border pt-8 first:border-t-0">
      {eyebrow && <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-accent">{eyebrow}</p>}
      <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
      {description && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{description}</p>}
    </div>
  );
}

function EndpointCard({ endpoint }: { endpoint: DocEndpoint }) {
  const bodyText =
    typeof endpoint.body === "string" ? endpoint.body : endpoint.body ? JSON.stringify(endpoint.body, null, 2) : null;

  return (
    <article
      id={endpoint.id}
      data-doc-id={endpoint.id}
      className="scroll-mt-24 rounded-xl border border-border bg-card/60"
    >
      <header className="border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <MethodPill method={endpoint.method} />
          <code className="font-mono text-[12px] text-foreground">{endpoint.path}</code>
          <span className="ml-auto text-[10px] uppercase tracking-[0.14em] text-muted">{endpoint.title}</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted">{endpoint.description}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted">Scopes</span>
          {endpoint.scopes.map((scope) => (
            <code
              key={scope}
              className="rounded border border-border-strong bg-ink-850 px-1.5 py-0.5 font-mono text-[10px] text-muted-strong"
            >
              {scope}
            </code>
          ))}
        </div>
      </header>

      <div className="space-y-3 px-4 py-3">
        {endpoint.params?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.14em] text-muted">
                  <th className="pb-1.5 pr-3 font-medium">Parameter</th>
                  <th className="pb-1.5 pr-3 font-medium">Type</th>
                  <th className="pb-1.5 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {endpoint.params.map((param) => (
                  <tr key={param.name} className="border-t border-border/60 align-top">
                    <td className="py-1.5 pr-3 font-mono text-[11px] text-foreground">{param.name}</td>
                    <td className="py-1.5 pr-3 font-mono text-[11px] text-muted-strong">{param.type}</td>
                    <td className="py-1.5 text-muted">{param.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {bodyText && (
          <CodeBlock
            code={bodyText}
            label={typeof endpoint.body === "string" ? "Request" : "Request body"}
          />
        )}

        <CodeBlock
          code={JSON.stringify(endpoint.response, null, 2)}
          label={`Response · ${endpoint.status ?? 200}`}
          tone="response"
        />

        {endpoint.notes?.length ? (
          <ul className="space-y-1 border-l-2 border-border-strong pl-3 text-[12px] text-muted">
            {endpoint.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}

export function ApiDocs() {
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState<string>("quickstart");
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  const normalized = query.trim().toLowerCase();

  const sections = React.useMemo(() => {
    if (!normalized) return ENDPOINT_SECTIONS;
    return ENDPOINT_SECTIONS.map((section) => {
      const endpoints = section.endpoints.filter((endpoint) =>
        [endpoint.method, endpoint.path, endpoint.title, endpoint.description, ...endpoint.scopes]
          .join(" ")
          .toLowerCase()
          .includes(normalized),
      );
      return { ...section, endpoints };
    }).filter((section) => section.endpoints.length > 0 || section.title.toLowerCase().includes(normalized));
  }, [normalized]);

  React.useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-doc-id]"));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.getAttribute("data-doc-id") ?? "");
      },
      { rootMargin: "-8% 0px -78% 0px", threshold: 0 },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [sections]);

  const toc = (
    <nav className="space-y-6 pb-16">
      <div>
        <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted">Guide</p>
        <ul className="space-y-0.5">
          {GUIDE.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={() => setMobileNavOpen(false)}
                className={cn(
                  "block rounded px-2 py-1 text-[12.5px] transition",
                  active === item.id
                    ? "bg-accent/10 text-accent-soft"
                    : "text-muted hover:bg-ink-850 hover:text-foreground",
                )}
              >
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {sections.map((section) => (
        <div key={section.id}>
          <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted">{section.title}</p>
          <ul className="space-y-0.5">
            {section.endpoints.map((endpoint) => (
              <li key={endpoint.id}>
                <a
                  href={`#${endpoint.id}`}
                  onClick={() => setMobileNavOpen(false)}
                  className={cn(
                    "flex items-center gap-1.5 rounded px-2 py-1 text-[12px] transition",
                    active === endpoint.id
                      ? "bg-accent/10 text-accent-soft"
                      : "text-muted hover:bg-ink-850 hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "w-9 shrink-0 font-mono text-[9px]",
                      endpoint.method === "GET" && "text-sage",
                      endpoint.method === "POST" && "text-accent",
                      endpoint.method === "PATCH" && "text-amber-400",
                      endpoint.method === "DELETE" && "text-red-400",
                    )}
                  >
                    {endpoint.method}
                  </span>
                  <span className="truncate">{endpoint.title}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="mx-auto flex max-w-[1440px] gap-8 px-5 lg:px-8">
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-border/60 py-8 pr-4 lg:block">
        <div className="relative mb-5">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter endpoints…"
            aria-label="Filter API endpoints"
            className="h-8 w-full rounded-md border border-border-strong bg-ink-900/70 pl-8 pr-2 text-[12px] text-foreground outline-none transition placeholder:text-muted/70 focus:border-accent/60"
          />
        </div>
        {toc}
      </aside>

      <main className="min-w-0 flex-1 py-8 lg:py-10">
        <div className="mb-8 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
            <span className="rounded-full border border-border-strong px-2 py-0.5 font-mono">v1</span>
            <span>REST · JSON · API-key auth</span>
            <Link href="/app/settings/api" className="ml-auto inline-flex items-center gap-1 text-accent hover:underline">
              Create a key <ExternalLink className="size-3" />
            </Link>
          </div>
          <h1 className="font-serif text-4xl tracking-tight">Inkwell Agent API</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-muted">
            Read and write manuscripts from agents, scripts and services. Scoped API keys, predictable
            envelopes, consistent status codes, outbound webhooks and AI proxying — one REST surface for
            everything in the studio.
          </p>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/60 px-3 py-2">
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted">Base URL</span>
            <code className="font-mono text-[12px] text-muted-strong">https://your-domain.com/api/v1</code>
            <span className="ml-auto">
              <CopyButton value="https://your-domain.com/api/v1" label="Copy base URL" />
            </span>
          </div>
        </div>

        {/* mobile toc */}
        <div className="mb-8 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen((open) => !open)}
            className="w-full rounded-md border border-border-strong bg-ink-900 px-3 py-2 text-left text-sm text-muted-strong"
          >
            {mobileNavOpen ? "Hide contents" : "Contents"}
          </button>
          {mobileNavOpen && <div className="mt-3 rounded-lg border border-border bg-card p-3">{toc}</div>}
        </div>

        <div className="space-y-10">
          <section className="space-y-4">
            <SectionHeading
              id="quickstart"
              eyebrow="Getting started"
              title="Quickstart"
              description="Create a key in Settings → API, then make your first request. Keys look like ink_live_<prefix>_<secret> and are shown once."
            />
            <CodeBlock code={CURL_QUICKSTART} label="Shell" />
          </section>

          <section className="space-y-4">
            <SectionHeading
              id="conventions"
              eyebrow="Reference"
              title="Conventions"
              description="Every response is JSON with a single top-level data key. Errors carry a stable machine code. Lists are paginated with limit/offset."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-card/50 p-3">
                <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-muted">Success</p>
                <pre className="overflow-x-auto font-mono text-[11px] text-ink-200">{`{ "data": { … }, "pagination"?: { … } }`}</pre>
              </div>
              <div className="rounded-lg border border-border bg-card/50 p-3">
                <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-muted">Error</p>
                <pre className="overflow-x-auto font-mono text-[11px] text-ink-200">{`{ "error": { "code", "message", "details"? } }`}</pre>
              </div>
            </div>
            <ul className="space-y-1.5 text-[12.5px] text-muted">
              <li>
                Every response includes <code className="font-mono text-muted-strong">X-Request-Id</code>. Send
                your own to have it echoed.
              </li>
              <li>Timestamps are ISO 8601 UTC strings. IDs are UUIDs.</li>
              <li>
                Bodies are validated strictly: unknown fields are ignored, wrong types and unknown enums return
                <code className="ml-1 font-mono text-muted-strong">422 validation_error</code> with a{" "}
                <code className="font-mono text-muted-strong">details</code> array.
              </li>
              <li>
                Path parameters are the identifiers shown in the path — <code className="font-mono text-muted-strong">:id</code>{" "}
                (project), <code className="font-mono text-muted-strong">:cid</code> (chapter),{" "}
                <code className="font-mono text-muted-strong">:aid</code> (asset),{" "}
                <code className="font-mono text-muted-strong">:vid</code> (canvas),{" "}
                <code className="font-mono text-muted-strong">:bid</code> (block),{" "}
                <code className="font-mono text-muted-strong">:jobId</code> (export). All are UUIDs.
              </li>
              <li>Writes accept exactly one representation of a chapter body — `content` (TipTap JSON) or `content_md`.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <SectionHeading
              id="authentication"
              eyebrow="Reference"
              title="Authentication"
              description="Pass a workspace-scoped API key as a bearer token. The server stores only a SHA-256 hash; the prefix exists so you can identify a key later."
            />
            <CodeBlock
              code={`Authorization: Bearer ink_live_a1b2c3d4e5f6_9xQ2…`}
              label="Request header"
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[12px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.14em] text-muted">
                    <th className="pb-1.5 pr-3 font-medium">Scope</th>
                    <th className="pb-1.5 font-medium">Grants</th>
                  </tr>
                </thead>
                <tbody>
                  {SCOPE_TABLE.map((row) => (
                    <tr key={row.scope} className="border-t border-border/60">
                      <td className="py-1.5 pr-3 font-mono text-[11px] text-accent-soft">{row.scope}</td>
                      <td className="py-1.5 text-muted">{row.grants}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[12.5px] text-muted">
              Scope failures return <code className="font-mono text-muted-strong">403 insufficient_scope</code>{" "}
              with <code className="font-mono text-muted-strong">details.required</code> and{" "}
              <code className="font-mono text-muted-strong">details.granted</code>. Keys are workspace-scoped:
              they can reach projects the workspace owns or collaborates on, and nothing else.
            </p>
          </section>

          <section className="space-y-4">
            <SectionHeading
              id="rate-limits"
              eyebrow="Reference"
              title="Rate limits"
              description="Each key gets a token bucket sized by its configured requests-per-minute (default 100, max 6,000). Buckets refill continuously."
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[12px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.14em] text-muted">
                    <th className="pb-1.5 pr-3 font-medium">Header</th>
                    <th className="pb-1.5 font-medium">Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["X-RateLimit-Limit", "Requests allowed per minute for this key."],
                    ["X-RateLimit-Remaining", "Tokens left in the bucket."],
                    ["X-RateLimit-Reset", "Unix seconds when the bucket is full again."],
                    ["Retry-After", "Seconds to wait — sent only on a 429."],
                  ].map(([header, meaning]) => (
                    <tr key={header} className="border-t border-border/60">
                      <td className="py-1.5 pr-3 font-mono text-[11px] text-muted-strong">{header}</td>
                      <td className="py-1.5 text-muted">{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <CodeBlock
              tone="response"
              label="429 Too Many Requests"
              code={JSON.stringify(
                {
                  error: {
                    code: "rate_limited",
                    message: "Rate limit exceeded (100 requests/minute). Retry in 3s.",
                  },
                },
                null,
                2,
              )}
            />
            <p className="text-[12px] text-muted">
              Limiting is enforced per server instance (in-memory token buckets). Bursts may be admitted by
              separate instances; clients should still treat the headers as authoritative and back off.
            </p>
          </section>

          <section className="space-y-4">
            <SectionHeading
              id="errors"
              eyebrow="Reference"
              title="Errors"
              description="Codes are stable and safe to branch on. Messages are for humans and may change."
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[12px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.14em] text-muted">
                    <th className="pb-1.5 pr-3 font-medium">Code</th>
                    <th className="pb-1.5 pr-3 font-medium">Status</th>
                    <th className="pb-1.5 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {ERROR_CODES.map((row) => (
                    <tr key={row.code} className="border-t border-border/60">
                      <td className="py-1.5 pr-3 font-mono text-[11px] text-muted-strong">{row.code}</td>
                      <td className="py-1.5 pr-3 font-mono text-[11px] text-foreground">{row.status}</td>
                      <td className="py-1.5 text-muted">{row.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <CodeBlock
              tone="response"
              label="422 Unprocessable Entity"
              code={JSON.stringify(
                {
                  error: {
                    code: "validation_error",
                    message: "Request body failed validation.",
                    details: [{ field: "title", message: "Required" }],
                  },
                },
                null,
                2,
              )}
            />
          </section>

          {sections.map((section) => (
            <section key={section.id} className="space-y-4">
              <SectionHeading
                id={section.id}
                eyebrow="Endpoints"
                title={section.title}
                description={section.description}
              />
              <div className="space-y-4">
                {section.endpoints.map((endpoint) => (
                  <EndpointCard key={endpoint.id} endpoint={endpoint} />
                ))}
              </div>
            </section>
          ))}

          <section className="space-y-4">
            <SectionHeading
              id="webhooks"
              eyebrow="Events"
              title="Webhooks"
              description="Configure endpoints per project in Project settings → Webhooks. Inkwell POSTs JSON, retries failures up to three times with backoff, and logs every delivery."
            />
            <div className="rounded-lg border border-border bg-card/50 p-3 text-[12.5px] text-muted">
              Headers on every delivery:
              <code className="ml-1 font-mono text-[11px] text-muted-strong">X-Inkwell-Event</code> and
              <code className="ml-1 font-mono text-[11px] text-muted-strong">X-Inkwell-Signature: sha256=&lt;hex&gt;</code>.
            </div>
            <div className="space-y-3">
              {WEBHOOK_EVENTS_DOC.map((event) => (
                <details key={event.event} className="rounded-lg border border-border bg-card/40">
                  <summary className="cursor-pointer px-3 py-2.5 text-[13px] text-foreground marker:text-muted">
                    <span className="font-mono text-[12px] text-accent-soft">{event.event}</span>
                    <span className="ml-2 text-muted">{event.description}</span>
                  </summary>
                  <div className="border-t border-border p-3">
                    <CodeBlock code={JSON.stringify(event.payload, null, 2)} label="Payload" />
                  </div>
                </details>
              ))}
            </div>
            <p className="text-[12.5px] text-muted">
              Event selection is per endpoint. A delivery that returns a non-2xx status is retried (3 attempts
              total) and recorded with its status code, attempt count and error in the delivery log.
            </p>
          </section>

          <section className="space-y-4">
            <SectionHeading
              id="signatures"
              eyebrow="Security"
              title="Verifying signatures"
              description="The signature is an HMAC-SHA256 of the raw request body, keyed by the endpoint's secret. Compare in constant time, and verify before parsing JSON."
            />
            <CodeBlock code={SIGNATURE_SNIPPET_NODE} label="Node.js" />
            <CodeBlock code={SIGNATURE_SNIPPET_PY} label="Python" />
            <p className="text-[12px] text-muted">
              Signing secrets are per endpoint and can be revealed or rotated from the Webhooks panel.
              Rotation immediately changes future signatures.
            </p>
          </section>

          <footer className="border-t border-border py-8 text-[12px] text-muted">
            <p>
              Questions, or an endpoint you need that does not exist? Write to{" "}
              <a href="mailto:api@inkwell.studio" className="text-accent hover:underline">
                api@inkwell.studio
              </a>
              .
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
