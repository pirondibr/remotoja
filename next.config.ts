import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [
      // Alias do painel interno (logs / análise) → /admin
      {
        source: "/dashboard",
        destination: "/admin",
        permanent: false,
      },
      {
        source: "/dashboard/:path*",
        destination: "/admin",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
