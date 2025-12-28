const path = require("path");
const { withSentryConfig } = require("@sentry/nextjs");

const shouldEnableSentry =
  Boolean(process.env.SENTRY_AUTH_TOKEN) &&
  Boolean(process.env.SENTRY_ORG) &&
  Boolean(process.env.SENTRY_PROJECT);

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@supabase/supabase-js"],
  sentry: {
    hideSourceMaps: true
  },
  webpack: (config) => {
    config.resolve.alias["@supabase/supabase-js"] = path.resolve(
      __dirname,
      "node_modules/@supabase/supabase-js/dist/module/index.js"
    );
    return config;
  }
};

const sentryWebpackPluginOptions = {
  silent: true,
};

module.exports = shouldEnableSentry
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;
