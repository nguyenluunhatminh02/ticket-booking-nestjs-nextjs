import type { NextConfig } from "next";

const publicApi = process.env.NEXT_PUBLIC_API_URL || "";

// Rewrites are baked into .next at build time. A localhost destination would
// point browser-proxied /api requests at the frontend container itself.
const isLocalhostUrl = (value: string): boolean => {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
};

const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL ||
  (publicApi.startsWith("http") ? publicApi.replace("/api/v1", "") : "") ||
  "http://localhost:3001";

if (publicApi === "/api" && isLocalhostUrl(BACKEND_URL)) {
  throw new Error(
    "BACKEND_INTERNAL_URL must be a reachable internal backend origin " +
      "(e.g. http://backend:3001) when NEXT_PUBLIC_API_URL=/api; " +
      `got ${BACKEND_URL}`,
  );
}

const nextConfig: NextConfig = {
  output: "standalone",

  // Performance: enable gzip compression
  compress: true,

  // Security: remove X-Powered-By header
  poweredByHeader: false,

  // Strict mode for catching bugs early
  reactStrictMode: true,

  // Image optimization
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "graph.microsoft.com" },
      { protocol: "https", hostname: "image.mux.com" },
      { protocol: "http", hostname: "localhost" },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60,
  },

  // Tree-shake large icon/component libraries
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-icons",
      "sonner",
    ],
  },

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
