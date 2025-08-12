/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use standalone for better Vercel compatibility and smaller bundle sizes
  output: 'standalone',

  // External packages that should not be bundled in serverless functions
  serverExternalPackages: [
    'sharp',
    'onnxruntime-node'
  ],

  // Override the default webpack configuration
  webpack: (config) => {
    // See https://webpack.js.org/configuration/resolve/#resolvealias
    config.resolve.alias = {
      ...config.resolve.alias,
      "sharp$": false,
      "onnxruntime-node$": false,
    };
    return config;
  },
};

module.exports = nextConfig;