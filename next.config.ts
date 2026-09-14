import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Produces a self-contained server bundle so the runtime image can drop node_modules.
  output: 'standalone',
  poweredByHeader: false,
  compress: true,
};

export default nextConfig;
