# Setting up docspp

docspp renders diagrams inside an **Astro** site (usually with **Starlight** for the docs chrome). Use the project's package manager; examples use pnpm.

## Is it published?

Check before giving install commands:

```sh
npm view @packagelab/docspp-core version
```

If that prints a version, follow the steps below. If it says the package is not found, docspp is **not published yet**. Then the user works from its repository, `https://github.com/AhmeddBasemm/docspp`: clone it, run `pnpm install`, and either use `pnpm dev:template` (the starter project) or copy `templates/starter` into their own repository. Say so plainly; do not invent a registry.

## Start a new site

```sh
npm create docspp@latest my-docs
cd my-docs
pnpm install
pnpm dev                 # http://localhost:4321
```

This creates an Astro + Starlight project with an example diagram (`diagrams/shop`), three pages, a GitHub Pages workflow, and this skill. The folder must be empty or not exist. Edit `diagrams/shop/diagram.yaml` and the page reloads.

## Add docspp to an existing Astro + Starlight site

1. **Install.**
   ```sh
   pnpm add @packagelab/docspp-astro @packagelab/docspp-react @astrojs/react react react-dom
   pnpm add -D docspp
   ```
   On pnpm 10 or later, allow the build scripts it asks about by adding to `pnpm-workspace.yaml`:
   ```yaml
   allowBuilds:
     esbuild: true
     sharp: true
   ```
2. **Register the integrations** in `astro.config.mjs`:
   ```js
   import react from '@astrojs/react'
   import starlight from '@astrojs/starlight'
   import docspp from '@packagelab/docspp-astro'
   import { defineConfig } from 'astro/config'

   export default defineConfig({
     integrations: [
       docspp(),                 // compiles diagrams/ at build time; the build fails on a broken diagram
       react(),
       starlight({
         title: 'My docs',
         // Widens the content column for diagrams and keeps prose at a readable width.
         customCss: ['@packagelab/docspp-astro/starlight.css'],
       }),
     ],
   })
   ```
   `docspp({ dir: 'my-diagrams' })` changes the folder (default `diagrams`).
3. **Types.** In `src/env.d.ts` add `/// <reference types="@packagelab/docspp-astro/virtual" />`.
4. **A first diagram.**
   ```sh
   pnpm docspp new shop
   pnpm docspp schema        # editor autocomplete for diagram.yaml
   pnpm docspp check
   ```
5. **A page** (`src/content/docs/shop.mdx`):
   ```mdx
   ---
   title: Shop
   tableOfContents: false
   ---
   import Diagram from '@packagelab/docspp-astro/Diagram.astro'

   <Diagram name="shop" />
   ```
6. Add `"check": "docspp check"` to `package.json` scripts, and run it in CI.

For an Astro site without Starlight, the same steps apply except for `customCss`; give the diagram a wide container.

## Publish to GitHub Pages

The template ships `.github/workflows/deploy.yml`. For an existing site, add a workflow that installs, runs `pnpm check`, builds with `SITE_URL=https://<owner>.github.io` and `BASE_PATH=/<repo>`, and deploys `dist/` with `actions/deploy-pages`. In `astro.config.mjs` use `site: process.env.SITE_URL, base: process.env.BASE_PATH`.

The repository's **Settings → Pages → Source** must be set to **GitHub Actions** once. Until it is, the deploy step fails with a 404; the template's workflow detects that and skips the step with a notice.

## Install this skill in another project

```sh
npx skills add AhmeddBasemm/docspp --skill docspp          # this project
npx skills add AhmeddBasemm/docspp --skill docspp -g       # every project
```

Projects created with `create-docspp` already contain it in `.claude/skills/docspp`.
