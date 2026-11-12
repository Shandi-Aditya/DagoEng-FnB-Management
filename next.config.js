const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.BUILD_DIR || '.next',
  // Pin tracing to this project; a lockfile elsewhere on the machine can confuse root inference
  outputFileTracingRoot: path.join(__dirname),
  env: {
    ALLOW_DEMO_UAT: 'true',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

module.exports = nextConfig;
