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
  }
};

const sentryWebpackPluginOptions = {
  silent: true,
};

module.exports = shouldEnableSentry
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;
