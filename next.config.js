/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // SIN output: 'export' - eso causa problemas con routing
  images: {
    unoptimized: true
  }
}

module.exports = nextConfig