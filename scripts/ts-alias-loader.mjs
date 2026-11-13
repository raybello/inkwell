import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);

function resolveFile(baseUrl, suffix = "") {
  const url = new URL(baseUrl.href + suffix);
  if (existsSync(fileURLToPath(url)) && !url.pathname.endsWith("/")) return url;
  return null;
}

/**
 * ESM resolve hook that teaches Node's built-in TypeScript stripper two things:
 *  - `@/...` path aliases resolve from the repo root
 *  - extensionless imports resolve to `.ts`, `.tsx`, or `/index.ts`
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/headers") {
    return { url: new URL("./shims/next-headers.mjs", import.meta.url).href, shortCircuit: true };
  }

  let base = null;
  if (specifier.startsWith("@/")) {
    base = new URL(specifier.slice(2), root);
  } else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    base = new URL(specifier, context.parentURL);
  }

  if (base) {
    const candidates = [
      base,
      new URL(`${base.href}.ts`),
      new URL(`${base.href}.tsx`),
      new URL(`${base.href}/index.ts`),
    ];
    for (const candidate of candidates) {
      if (candidate.pathname.endsWith("/")) continue;
      if (existsSync(fileURLToPath(candidate))) {
        return { url: candidate.href, shortCircuit: true };
      }
    }
    if (specifier.startsWith("@/")) {
      throw new Error(`Cannot resolve alias ${specifier}`);
    }
  }

  return nextResolve(specifier, context);
}
