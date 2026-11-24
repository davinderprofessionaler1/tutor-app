import type { NextConfig } from "next";

const nextConfig: NextConfig = { transpilePackages: ["@tutor/contracts"], devIndicators: { position: "bottom-right" } };
export default nextConfig;
