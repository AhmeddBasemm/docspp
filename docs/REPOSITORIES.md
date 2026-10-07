# Repositories, packages and releases

## How many repositories?

**One that you work in, and optionally a second that is generated.**

| Repository | Needed? | What it is |
|---|---|---|
| **This one** (the monorepo) | yes | Everything you edit: the packages, the docs and landing site, the template's source, the scaffolder. |
| **A template repository** | only for the GitHub "Use this template" button | A copy of `templates/starter`, written by CI after each release. Nobody edits it by hand. |
| A separate repository for the landing page and docs | **no** | They live in `apps/docs`, next to the code they describe. |

`npm create docspp@latest my-docs` works without the template repository: the scaffolder carries its own copy of the template. Create the template repository only if you also want people to click **Use this template** on GitHub.

### Why the docs and landing page stay here

- A change to the format, the renderer or the CLI and the page that documents it go in **one pull request**, and CI builds both. A separate docs repository drifts.
- The docs site doubles as the live demo and as an end-to-end test (`pnpm test:e2e` drives it in Chrome).
- One issue tracker, one place to look.

Split it out only if different people own the docs, or they need a different release rhythm, or you want a docs site for several products. None of that is true yet.

### Why the template is generated, not hand-maintained

A GitHub template has to be a repository root, and it must depend on **published** `@packagelab/docspp-*` versions, not on workspace links, so users get upgrades by bumping a dependency rather than owning a copy of the engine. The monorepo cannot be that template. So `templates/starter` is the source of truth, `scripts/template.mjs` turns it into a standalone project (versions pinned to the current release, placeholders filled, the shared `author-diagram` skill added), and the sync workflow pushes the result to the template repository.

## What is where

```
packages/
  core/            @packagelab/docspp-core        schema, compiler, layout, router, timeline
  react/           @packagelab/docspp-react       <DiagramView> and styles
  astro/           @packagelab/docspp-astro       Astro integration and <Diagram>
  cli/             docspp                         the `docspp` command
  create-docspp/    create-docspp       `npm create docspp`; carries a copy of the template
apps/
  docs/            docspp-docs        the tool's landing page, guides and live examples (private)
templates/
  starter/         my-docs            the project users start from (private; source of truth)
skills/
  docspp/          the agent skill (SKILL.md + references/ + a tested example); installable with `npx skills add`
scripts/
  build.mjs        builds one package into dist/ (esbuild + tsc declarations)
  template.mjs     templates/starter -> a standalone project
  verify-pack.mjs  packs, scaffolds, installs, builds and loads, like a user would
.changeset/        release notes and versioning
```

In the monorepo, every package's `exports` point at its TypeScript sources, so nothing has to be built to develop. `publishConfig.exports` points at `dist/`, and pnpm applies it when packing. The five packages are versioned together.

## The agent skill

`skills/docspp` is the one copy of the skill. It reaches people three ways, none of which needs a registry:

- **`npx skills add AhmeddBasemm/docspp --skill docspp`** installs it into any project, from this repository on GitHub. The installer scans `skills/` (and `.claude/skills/`), so nothing has to be published. skills.sh lists skills by how often they are installed; there is no submission step. The repository has to be **public** for other people to install from it.
- **New projects** get it automatically: `scripts/template.mjs` copies the folder into the template, and `create-docspp` ships that.
- **This repository's own agents** use it through `.claude/skills/docspp`, a symlink to `skills/docspp`.

`packages/cli/test/skill.test.ts` keeps it honest: the example diagram must compile, every link must resolve, and the node, edge and step kinds, the schema fields and the CLI commands it describes must match the code. Change the format and that test tells you which part of the skill to update.

## Everyday tasks

| I want to | Do |
|---|---|
| Change the format, layout or renderer | Edit `packages/*`, update `apps/docs` and the skill in the same change. `pnpm test`, `pnpm test:e2e`. |
| Change what new projects start with | Edit `templates/starter`. `pnpm dev:template` to see it; `pnpm verify:pack` proves a fresh project installs and builds from packed packages. |
| Change the docs or landing page | Edit `apps/docs`. `pnpm dev`. |
| Change the agent skill | Edit `skills/docspp`, then `pnpm test`. To try an install: `npx skills add . --skill docspp --copy` from an empty folder. |
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

- [x] **A license.** MIT, in `LICENSE`; each build copies it into the package folders, and `verify:pack` checks it is in every tarball.
- [x] **The npm names.** The org is `packagelab`. Libraries are `@packagelab/docspp-core`, `-react` and `-astro`; the CLI is the unscoped `docspp` (so `npx docspp check` works) and the scaffolder is the unscoped `create-docspp` (so `npm create docspp` works). Renaming after the first publish is expensive, so treat these as fixed. They appear in each `package.json`, `scripts/build.mjs`, `templates/starter/package.json`, `.changeset/config.json`, the skill and the docs.
- [ ] **URLs.** `homepage` and `repository` in the root and package `package.json` files point at `github.com/AhmeddBasemm/docspp`. Update them if the repository moves.
- [ ] **npm token.** For automated releases, create an automation token that can publish to the `packagelab` org and add it as the `NPM_TOKEN` repository secret. The first publish can be done from a laptop with `npm login` and `pnpm release`.
- [ ] **Turn it on.** Set the repository variable `RELEASE_ENABLED` to `true`.
- [x] **Make the repository public** if people should be able to run `npx skills add <you>/docspp` against it.
- [ ] **Docs site.** In repository settings, set Pages to the **GitHub Actions** source. Until then the docs workflow still builds the site but skips the deploy step with a notice, so CI stays green. After that it deploys `apps/docs` on every push to `main`. Remove the "not published yet" note in `apps/docs/src/content/docs/guides/getting-started.mdx` once the packages are live.

### The template repository (optional)

1. Create an empty repository, for example `your-name/docspp-starter`, and tick **Template repository** in its settings.
2. In this repository set the variable `TEMPLATE_REPO` to `your-name/docspp-starter` and the secret `TEMPLATE_REPO_TOKEN` to a token with write access to it.
3. Run **Sync template repository** once by hand (Actions tab) after the first release.

You can preview what it will contain at any time: `node scripts/template.mjs --out /tmp/docspp-starter`.
