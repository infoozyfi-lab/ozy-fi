/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export — this is what makes the site a plain folder of
  // HTML/CSS/JS that you can drag-and-drop into Cloudflare Pages.
  output: 'export',
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
