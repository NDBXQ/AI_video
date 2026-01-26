/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "coze-coding-project.tos.coze.site",
        pathname: "/**"
      },
      {
        protocol: "https",
        hostname: "integration.coze.cn",
        pathname: "/**"
      }
    ]
  }
}

module.exports = nextConfig
