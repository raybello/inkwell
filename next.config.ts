import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "32mb" },
  },
  serverExternalPackages: ["pdf-lib", "docx", "jszip", "turndown"],
  // Baseline security headers. A full CSP is deliberately NOT set here:
  // Next injects inline bootstrap scripts and tldraw ships its own inline
  // styles, so a strict CSP needs per-route policy work and a staging pass.
  // Logged as a follow-up in docs/ARCHITECTURE-REVIEW.md.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
