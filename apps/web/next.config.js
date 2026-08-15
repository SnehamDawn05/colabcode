/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Linting is handled separately; don't fail production builds on lint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Type errors are checked in CI via pnpm typecheck; skip during next build
    ignoreBuildErrors: true,
  },
  transpilePackages: [
    "@colab-code/db",
    "@colab-code/shared",
    "@colab-code/validation",
    "@colab-code/ui",
  ],
  webpack: (config, { isServer: _isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    config.module.rules.push({
      test: /\.wasm$/,
      type: "webassembly/async",
    });

    config.output.webassemblyModuleFilename = "../static/wasm/[modulehash].wasm";

    return config;
  },
};

module.exports = nextConfig;
