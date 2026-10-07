import react from '@astrojs/react'
import starlight from '@astrojs/starlight'
import docspp from '@packagelab/docspp-astro'
import { defineConfig } from 'astro/config'

// For GitHub Pages set `site` and `base` (see .github/workflows/deploy.yml).
export default defineConfig({
  site: process.env.SITE_URL,
  base: process.env.BASE_PATH,
  integrations: [
    docspp(),
    react(),
    starlight({
      title: 'docspp',
      description: 'Architecture diagrams you can click, filter and play.',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com' }],
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
        { label: 'Start here', items: [{ slug: 'guides/getting-started' }] },
        {
          label: 'Guides',
          items: [
            { slug: 'guides/writing-diagrams' },
            { slug: 'guides/scenarios' },
            { slug: 'guides/icons-and-theming' },
            { slug: 'guides/ai-authoring' },
          ],
        },
        {
          label: 'Examples',
          items: [
            { slug: 'examples/checkout' },
            { slug: 'examples/platform' },
            { slug: 'examples/payments' },
          ],
        },
      ],
    }),
  ],
})
