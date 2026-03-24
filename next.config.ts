import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Streaming chat: double-mount in Strict Mode aborts the first SSE consumer and
  // can leave the UI stuck with no tokens; disable for reliable dev/prod behavior.
  reactStrictMode: false,
};

export default nextConfig;
