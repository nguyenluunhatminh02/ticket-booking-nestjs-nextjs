import type { NextConfig } from "next";

const publicApi = process.env.NEXT_PUBLIC_API_URL || "";
const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL ||
  (publicApi.startsWith("http") ? publicApi.replace("/api/v1", "") : "") ||
  "http://localhost:3001";

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
