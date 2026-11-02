import type { NextConfig } from 'next';

const javaOrigin = process.env.JAVA_API_ORIGIN ?? 'http://backend:8080';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['frontend-dev'],
  output: 'standalone',
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${javaOrigin}/api/:path*` },
      { source: '/demo/:path*', destination: `${javaOrigin}/demo/:path*` },
    ];
  },
};

export default nextConfig;
