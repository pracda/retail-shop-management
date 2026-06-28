import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Security headers on every response
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options',  value: 'nosniff' },
          { key: 'X-Frame-Options',          value: 'DENY' },
          { key: 'X-XSS-Protection',         value: '1; mode=block' },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=(), payment=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",   // unsafe-eval needed by Next.js HMR in dev
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              // Extract just the origin (scheme+host+port) so CSP allows all API subpaths
              `connect-src 'self' ${(() => { try { return new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080').origin } catch { return 'http://localhost:8080' } })()}`,
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },

  // Proxy API calls through Next.js to avoid exposing backend URL in client (optional)
  async rewrites() {
    return []
  },
}

export default nextConfig
