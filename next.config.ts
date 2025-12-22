import type { NextConfig } from "next";

function getSupabaseHostname() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const supabaseHostname = getSupabaseHostname();

const nextConfig: NextConfig = {
  transpilePackages: ["@campus-hub/db"],
  images: supabaseHostname
    ? {
        remotePatterns: [
          {
            protocol: "https",
            hostname: supabaseHostname,
            pathname: "/storage/v1/object/public/avatars/**",
          },
        ],
      }
    : undefined,
  turbopack: {
    resolveAlias: {
      "@supabase/supabase-js": "@supabase/supabase-js/dist/module/index.js",
    },
  },
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias ??= {};
    config.resolve.alias["@supabase/supabase-js"] =
      "@supabase/supabase-js/dist/module/index.js";
    return config;
  },
};

export default nextConfig;
