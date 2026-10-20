


const SentryWebpackPlugin = require("@sentry/webpack-plugin");

const {
  NEXT_PUBLIC_SERVICE_VERSION: SERVICE_VERSION,
  SENTRY_AUTH_TOKEN,
  NODE_ENV,
} = process.env;

const SENTRY_DSN =
  "https://9cfb47804c93495ba3a66a9d79cec084@o440615.ingest.sentry.io/5557379";

const config = {
  // Compile the shared workspace packages along with the app.
  transpilePackages: ["@koh/common", "@koh/api-client"],
  productionBrowserSourceMaps: true,
  // Replaces the old babel-plugin-styled-components setup.
  compiler: {
    styledComponents: {
      ssr: true,
      displayName: true,
    },
  },
  // Lint runs separately with `yarn lint` at the repo root.
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, options) => {

    // Webpack to replace @sentry/node imports with @sentry/browser when
    // building the browser's bundle
    if (!options.isServer) {
      config.resolve.alias["@sentry/node"] = "@sentry/browser";
    }
    if (
      (SERVICE_VERSION,
      SENTRY_DSN,
      SENTRY_AUTH_TOKEN && NODE_ENV === "production")
    ) {
      config.plugins.push(
        new SentryWebpackPlugin({
          org: "sandboxnu",
          project: "khoury-office-hours-frontend",
          include: ".next",
          ignore: ["node_modules"],
          urlPrefix: "~/_next",
          release: SERVICE_VERSION,
        })
      );
    }
    return config;
  },
};

module.exports = config;
