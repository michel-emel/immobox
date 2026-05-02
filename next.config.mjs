/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 3600,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',                    value: 'DENY' },
          { key: 'X-Content-Type-Options',             value: 'nosniff' },
          { key: 'Referrer-Policy',                    value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection',                   value: '1; mode=block' },
          { key: 'Permissions-Policy',                  value: 'camera=(), microphone=(), geolocation=(self)' },
          { key: 'Strict-Transport-Security',           value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
  poweredByHeader: false,
  compress:        true,
  reactStrictMode: true,
};

export default nextConfig;
