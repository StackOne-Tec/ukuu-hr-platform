import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  /* The admin portal and the standard app run as separate dev servers; giving
     each mode its own build directory stops them fighting over .next's dev lock
     when both are running locally (npm run dev + npm run dev:admin). */
  distDir: process.env.NEXT_PUBLIC_PLATFORM === "admin" ? ".next-admin" : ".next",
};

export default nextConfig;
