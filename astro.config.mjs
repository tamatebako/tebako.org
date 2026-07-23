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
  vite: {
    plugins: [tailwindcss()],
  },
})
