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
      // Atalho antigo / marketing: feed do membro vive em /app
      {
        source: "/dashboard",
        destination: "/app",
        permanent: false,
      },
      {
        source: "/dashboard/:path*",
        destination: "/app",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
