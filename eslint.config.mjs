import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  {
    ignores: [
      ".next/**",
      ".vercel/**",
      "node_modules/**",
      "next-env.d.ts",
      "scripts/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // The codebase leans on deliberate, documented `any` (withApi's route
      // context, Supabase row casts). Real bugs are caught by strict tsc;
      // keep this as a warning so new code is nudged without blocking.
      "@typescript-eslint/no-explicit-any": "warn",
      // Empty catch blocks are intentional in fire-and-forget telemetry
      // (webhook emit, last_used_at update) where a failure must not throw.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      "@typescript-eslint/no-non-null-assertion": "off",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];

export default config;
