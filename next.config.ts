import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false, // Desabilitado para melhor performance
  serverExternalPackages: [
    '@libsql/client',
    '@prisma/adapter-libsql',
    '@libsql/linux-x64-gnu',
    '@libsql/win32-x64-msvc',
  ],
};

export default nextConfig;
