/** @type {import('next').NextConfig} */
const authTokenHeaders = [
  { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
];

const nextConfig = {
  async headers() {
    return [
      { source: '/auth/confirm', headers: authTokenHeaders },
      { source: '/auth/confirm/:path*', headers: authTokenHeaders },
      { source: '/auth/owner-confirm', headers: authTokenHeaders },
      { source: '/auth/owner-confirm/:path*', headers: authTokenHeaders },
      { source: '/auth/owner-password', headers: authTokenHeaders },
    ];
  },
};

export default nextConfig;
