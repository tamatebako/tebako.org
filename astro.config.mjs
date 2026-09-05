import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import vue from '@astrojs/vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  site: 'https://www.tebako.org',
  trailingSlash: 'always',
  output: 'static',
  integrations: [
    sitemap(),
    vue(),
  ],
  build: {
    format: 'directory',
  },
  redirects: {
    '/blog/2026-09-01-tebako-v2-stable-metanorma': '/blog/2026-09-05-advanced-payloads-packed-mn/',
    '/blog/2026-09-02-tebako-v2-anatomy-tpkg': '/blog/2026-09-05-architecture-three-part-package/',
    '/blog/2026-09-03-tebako-v2-cross-runtime-composition': '/blog/2026-09-05-advanced-payloads-packed-mn/',
    '/blog/2026-09-04-tebako-v2-jail-host-routing': '/blog/2026-09-05-advanced-payloads-jails-profiles/',
    '/blog/2026-09-05-tebako-v2-developer-story-benchmarks': '/blog/2026-09-05-basic-payloads-publish/',
    '/blog/2026-08-22-tebako-v0.2.0-trace-and-check': '/blog/2026-08-22-trace-and-check/',
    '/docs/architecture/features': '/docs/architecture/overview/',
    '/docs/architecture/rust-track': '/docs/architecture/repositories/',
    '/docs/architecture/pipeline': '/docs/architecture/factories/',
    '/docs/architecture/version-manager': '/docs/architecture/dispatch/',
  },
  vite: {
    plugins: [tailwindcss()],
  },
})
