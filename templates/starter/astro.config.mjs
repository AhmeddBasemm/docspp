import react from '@astrojs/react'
import starlight from '@astrojs/starlight'
import docspp from '@packagelab/docspp-astro'
import { defineConfig } from 'astro/config'

// Publishing to GitHub Pages: the deploy workflow sets SITE_URL and BASE_PATH for you.
export default defineConfig({
  site: process.env.SITE_URL,
  base: process.env.BASE_PATH,
  integrations: [
    docspp(),
    react(),
    starlight({
      title: 'My docs',
      description: 'How our system works, with diagrams you can play.',
      customCss: [
        '@fontsource/ibm-plex-sans/400.css',
        '@fontsource/ibm-plex-sans/500.css',
        '@fontsource/ibm-plex-sans/600.css',
        '@fontsource/ibm-plex-mono/400.css',
        '@fontsource/ibm-plex-mono/500.css',
        '@packagelab/docspp-astro/starlight.css',
        './src/styles/custom.css',
      ],
      sidebar: [
        { label: 'Overview', slug: 'index' },
        { label: 'How the shop works', slug: 'architecture' },
        { label: 'Editing diagrams', slug: 'editing' },
      ],
    }),
  ],
})
