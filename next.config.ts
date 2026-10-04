import type { NextConfig } from "next";

// Cabeçalhos de segurança aplicados a todas as respostas.
// Conjunto conservador (sem CSP estrito, que exigiria allowlist dos serviços
// externos — Google Maps/Places, WordPress — e poderia quebrar a UI). Cobre
// clickjacking, MIME-sniffing, vazamento de referer e força HTTPS.
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "Permissions-Policy", value: "geolocation=(), microphone=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: false, // Desabilitado para melhor performance
  serverExternalPackages: [
    '@libsql/client',
    '@prisma/adapter-libsql',
    '@libsql/linux-x64-gnu',
    '@libsql/win32-x64-msvc',
  ],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
