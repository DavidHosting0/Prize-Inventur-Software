import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  transpilePackages: ["@prize/ui", "@prize/types", "@prize/validators", "@prize/api-client"],
  serverExternalPackages: ["exceljs", "pdf-lib", "@prisma/client"],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    webpackMemoryOptimizations: true,
    // Next 15 defaults dynamic staleTime to 0 — every sidebar click refetches RSC (~100ms+).
    // Keep a short client router cache so revisiting categories feels instant without heavy caching.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  onDemandEntries: {
    maxInactiveAge: 60_000,
    pagesBufferLength: 8,
  },
};

export default withNextIntl(nextConfig);
