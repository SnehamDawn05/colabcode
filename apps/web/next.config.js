/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
