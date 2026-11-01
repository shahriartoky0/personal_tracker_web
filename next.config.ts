import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    // Proof images are compressed in the browser (<~1 MB); this leaves headroom. Hosting caps still apply (Vercel: 4.5 MB).
    serverActions: { bodySizeLimit: "5mb" },
  },
}

export default nextConfig
