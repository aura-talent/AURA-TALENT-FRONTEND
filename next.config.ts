import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const baseConfig: NextConfig = {
  // Silence Turbopack's webpack-config warning in dev
  ...(isDev ? { turbopack: {} } : {}),
};

// Only apply next-pwa in production — Turbopack is incompatible with its webpack plugin
async function buildConfig() {
  if (isDev) {
    return baseConfig;
  }
  const withPWAInit = (await import("@ducanh2912/next-pwa")).default;
  const withPWA = withPWAInit({
    dest: "public",
    cacheOnFrontEndNav: true,
    aggressiveFrontEndNavCaching: true,
    reloadOnOnline: true,
    disable: false,
    workboxOptions: {
      disableDevLogs: true,
    },
  });
  return withPWA(baseConfig);
}

export default buildConfig();
