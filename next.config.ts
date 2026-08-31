import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["bun:sqlite"],
  allowedDevOrigins: ['10.126.126.7'],
  logging: {
    incomingRequests: true,
    serverFunctions: true,
  },
};

export default nextConfig;
