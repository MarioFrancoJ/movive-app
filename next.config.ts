import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Serve modern formats when the browser supports them.
    formats: ["image/avif", "image/webp"],
    // Allow optimizing images served from Supabase Storage (recipe images live
    // in the public `recipe-images` bucket). A wildcard on the supabase.co host
    // keeps this working across environments/projects without hardcoding a ref.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
