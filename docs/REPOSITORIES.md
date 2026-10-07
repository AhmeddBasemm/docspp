# Repositories, packages and releases

## How many repositories?

**One that you work in, and optionally a second that is generated.**

| Repository | Needed? | What it is |
|---|---|---|
| **This one** (the monorepo) | yes | Everything you edit: the packages, the docs and landing site, the template's source, the scaffolder. |
| **A template repository** | only for the GitHub "Use this template" button | A copy of `templates/starter`, written by CI after each release. Nobody edits it by hand. |
| A separate repository for the landing page and docs | **no** | They live in `apps/docs`, next to the code they describe. |

`npm create idocs@latest my-docs` works without the template repository: the scaffolder carries its own copy of the template. Create the template repository only if you also want people to click **Use this template** on GitHub.

### Why the docs and landing page stay here

- A change to the format, the renderer or the CLI and the page that documents it go in **one pull request**, and CI builds both. A separate docs repository drifts.
- The docs site doubles as the live demo and as an end-to-end test (`pnpm test:e2e` drives it in Chrome).
- One issue tracker, one place to look.

Split it out only if different people own the docs, or they need a different release rhythm, or you want a docs site for several products. None of that is true yet.

### Why the template is generated, not hand-maintained

A GitHub template has to be a repository root, and it must depend on **published** `@idocs/*` versions, not on workspace links, so users get upgrades by bumping a dependency rather than owning a copy of the engine. The monorepo cannot be that template. So `templates/starter` is the source of truth, `scripts/template.mjs` turns it into a standalone project (versions pinned to the current release, placeholders filled, the shared `author-diagram` skill added), and the sync workflow pushes the result to the template repository.

## What is where

```
packages/
  core/            @idocs/core        schema, compiler, layout, router, timeline
  react/           @idocs/react       <DiagramView> and styles
  astro/           @idocs/astro       Astro integration and <Diagram>
  cli/             @idocs/cli         the `idocs` command
  create-idocs/    create-idocs       `npm create idocs`; carries a copy of the template
apps/
  docs/            @idocs/docs        the tool's landing page, guides and live examples (private)
templates/
  starter/         my-docs            the project users start from (private; source of truth)
scripts/
  build.mjs        builds one package into dist/ (esbuild + tsc declarations)
  template.mjs     templates/starter -> a standalone project
  verify-pack.mjs  packs, scaffolds, installs, builds and loads, like a user would
.changeset/        release notes and versioning
```

In the monorepo, every package's `exports` point at its TypeScript sources, so nothing has to be built to develop. `publishConfig.exports` points at `dist/`, and pnpm applies it when packing. The five packages are versioned together.

## Everyday tasks

| I want to | Do |
|---|---|
| Change the format, layout or renderer | Edit `packages/*`, update `apps/docs` and the skill in the same change. `pnpm test`, `pnpm test:e2e`. |
| Change what new projects start with | Edit `templates/starter`. `pnpm dev:template` to see it; `pnpm verify:pack` proves a fresh project installs and builds from packed packages. |
| Change the docs or landing page | Edit `apps/docs`. `pnpm dev`. |
| Check everything CI checks | `pnpm lint && pnpm typecheck && pnpm test && pnpm check --strict && pnpm build:all` |
| Try the published experience without publishing | `pnpm verify:pack` (add `--keep` to keep the generated project). |
| Add a package | Create `packages/<name>`, add it to `CONFIG` in `scripts/build.mjs` and to the `fixed` list in `.changeset/config.json`. |

## Releasing

Releases use [changesets](https://github.com/changesets/changesets).

1. For a change users should hear about: `pnpm changeset`, pick the packages and the bump, commit the file.
2. On `main`, the **Release** workflow collects pending changesets into a "Version packages" pull request. Merging it publishes every package to npm and tags the release.
3. The **Sync template repository** workflow then pushes the new template to the template repository (if configured).

Both workflows are **off** until you opt in, so pushing to `main` can never publish by accident.

### Before the first release

These are your decisions; nothing here has been done for you.

- [ ] **A license.** There is no `LICENSE` file and no `license` field. Add both before publishing or making the repository public.
- [ ] **The npm names.** `@idocs/*` and `create-idocs` had no published packages when checked, but a scope can exist without packages. Create the `idocs` organisation on npm (`npm org create idocs` or on npmjs.com) to claim it. If you would rather use another name, it appears in `package.json` of each package, `scripts/build.mjs`, `scripts/template.mjs`, `templates/starter/package.json`, `.changeset/config.json` and the docs. Do the rename before the first publish; afterwards it is expensive.
- [ ] **URLs.** `homepage` and `repository` in the root and package `package.json` files point at `github.com/AhmeddBasemm/docspp`. Update them if the repository moves.
- [ ] **npm token.** Create an automation token that can publish the scope, and add it as the `NPM_TOKEN` repository secret.
- [ ] **Turn it on.** Set the repository variable `RELEASE_ENABLED` to `true`.
- [ ] **Docs site.** In repository settings, set Pages to the **GitHub Actions** source. The docs workflow deploys `apps/docs` on every push to `main`. Remove the "not published yet" note in `apps/docs/src/content/docs/guides/getting-started.mdx` once the packages are live.

### The template repository (optional)

1. Create an empty repository, for example `your-name/idocs-starter`, and tick **Template repository** in its settings.
2. In this repository set the variable `TEMPLATE_REPO` to `your-name/idocs-starter` and the secret `TEMPLATE_REPO_TOKEN` to a token with write access to it.
3. Run **Sync template repository** once by hand (Actions tab) after the first release.

You can preview what it will contain at any time: `node scripts/template.mjs --out /tmp/idocs-starter`.
