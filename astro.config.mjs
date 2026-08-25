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
    '/docs/architecture/features': '/docs/architecture/overview/',
    '/docs/architecture/rust-track': '/docs/architecture/repositories/',
    '/docs/architecture/pipeline': '/docs/architecture/factories/',
    '/docs/architecture/version-manager': '/docs/architecture/dispatch/',
  },
  vite: {
    plugins: [tailwindcss()],
  },
})
