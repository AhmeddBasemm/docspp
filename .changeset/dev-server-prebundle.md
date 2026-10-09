---
"@packagelab/docspp-astro": patch
---

Fix `astro dev` not rendering diagrams in a project made with `npm create docspp`. The integration asked Vite to pre-bundle `elkjs` through `@packagelab/docspp-core`, which a project that does not list that package itself (the starter, under pnpm) cannot see, so Vite found the layout library only after the page loaded and reloaded in the middle of hydration. Every pre-bundled entry is now reached through `@packagelab/docspp-astro`, and `d3-transition` is pre-bundled as well. If you added a workaround to `vite.optimizeDeps` in `astro.config.mjs`, you can remove it.
