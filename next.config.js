/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.BUILD_DIR || '.next',
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
