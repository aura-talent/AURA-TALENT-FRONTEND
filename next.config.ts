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
  // next-pwa is an optional devDependency whose types may or may not
  // resolve depending on whether it's installed in a given environment.
  // Use @ts-ignore (not @ts-expect-error) since it only suppresses an
  // error when one is actually present, instead of failing the build
  // itself when the import happens to type-check cleanly.
  // @ts-ignore next-pwa optional dependency
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
