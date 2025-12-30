/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/esp32/:path*',
        destination: 'http://192.168.1.73/:path*',
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/esp32/:path*',
        headers: [
          {
            key: 'Authorization',
            value: 'Bearer teste',
          },
        ],
      },
    ]
  },
}

export default nextConfig
