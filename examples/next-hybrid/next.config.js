const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // (Optional) Export as a static site
  // See https://nextjs.org/docs/pages/building-your-application/deploying/static-exports#configuration
  output: 'export', // Feel free to modify/remove this option

  // Next.js 16 uses Turbopack by default
  turbopack: {
    root: path.resolve(__dirname, '../..'),
  },

  // Override the default webpack configuration
  webpack: (config) => {
    // Ignore node-specific modules when bundling for the browser
    // See https://webpack.js.org/configuration/resolve/#resolvealias
    config.resolve.alias = {
      ...config.resolve.alias,
      "sharp$": false,
      "onnxruntime-node$": false,
    }
    return config;
  },
};

module.exports = nextConfig;