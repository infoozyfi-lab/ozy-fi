import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Default config — no ISR/incremental cache needed yet since the storefront
// data comes live from D1 on every request, not from Next.js's own cache.
export default defineCloudflareConfig();
