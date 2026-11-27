// Webpack config for building for production
const path = require('path');
const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');
const { sentryWebpackPlugin } = require('@sentry/webpack-plugin');

module.exports = function (options) {
  return {
    ...options,
    cache: {
      type: 'filesystem',
      buildDependencies: {
        config: [__filename],
      },
    },
    externals: [
      nodeExternals({
        allowlist: ['@koh/common'],
        additionalModuleDirs: [path.resolve(__dirname, '../../node_modules')], // handle yarn workspaces https://github.com/liady/webpack-node-externals/issues/39
      }),
    ],
    module: {
      rules: [
        {
          test: /.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /.tsx?$/,
          use: 'ts-loader',
          include: /@koh/, // Build packages we depend on
        },
      ],
    },
    devtool: 'source-map',
    plugins:
      process.env.SENTRY_AUTH_TOKEN && process.env.SERVICE_VERSION
        ? [
            // SERVICE_VERSION is the git hash, passed during build time.
            sentryWebpackPlugin({
              org: 'sandboxnu',
              project: 'khoury-office-hours',
              authToken: process.env.SENTRY_AUTH_TOKEN,
              release: { name: process.env.SERVICE_VERSION },
              sourcemaps: { assets: './dist/**' },
            }),
            // Write the build-time value of SERVICE_VERSION so it can be read at runtime
            new webpack.EnvironmentPlugin(['SERVICE_VERSION']),
          ]
        : [],
  };
};
