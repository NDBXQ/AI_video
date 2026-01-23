/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "coze-coding-project.tos.coze.site",
        pathname: "/**"
      }
    ]
  }
}

module.exports = nextConfig
