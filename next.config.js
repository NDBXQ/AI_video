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
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["*.dev.coze.site", "*.coze.site", "*.sandbox-dev.coze-coding.bytedance.net"],
      bodySizeLimit: "5mb"
    }
  }
}

module.exports = nextConfig
