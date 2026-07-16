/** @type {import('next').NextConfig} */
const staffConfirmationHeaders = [
  { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
];

const nextConfig = {
  async headers() {
    return [
      { source: '/auth/confirm', headers: staffConfirmationHeaders },
      { source: '/auth/confirm/:path*', headers: staffConfirmationHeaders },
    ];
  },
};

export default nextConfig;
