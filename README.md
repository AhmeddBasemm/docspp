# Interactive docs

Describe your system in YAML. Get architecture diagrams your readers can click, filter and **play**: pick a scenario and watch a request travel through the system, step by step.

- **Declarative.** Nodes, groups and edges in `diagram.yaml`. No coordinates; layout is automatic and steerable with a few hints.
- **Scenarios.** Any number per diagram: the happy path, a cache miss, a declined card. Each plays as packets over the architecture or as a sequence diagram, with a step list, scrubbing, speed control and shareable deep links.
- **One model, many views.** Write a node once; show it in an overview, a backend-only view, a per-team view.
- **Docs inside the picture.** Click a box for its markdown, connections and source references. Edge keys link to an interfaces table generated from the model.
- **Icons.** Brand logos for your stack (`postgresql`, `redis`, `keycloak`...), Lucide for the rest, your own SVGs too. Bundled at build time.
- **A real docs site.** Astro + Starlight: markdown pages, search, light and dark themes, static output for GitHub Pages.
- **Written to be generated.** A JSON Schema for the editor, a CLI whose errors say `file:line:col` and suggest fixes, and a Claude Code skill that knows the format.

## Start a project

```sh
npm create idocs@latest my-docs
cd my-docs
pnpm install
pnpm dev
```

Or use the GitHub template repository, if one is set up (see [docs/REPOSITORIES.md](docs/REPOSITORIES.md)).

> **Not published yet?** Until the packages are on npm, work from this repository: `pnpm install && pnpm dev` runs the docs site, and `pnpm dev:template` runs the starter project.

Edit `diagrams/shop/diagram.yaml`, save, and the page reloads:

```yaml
nodes:
  browser: { kind: client, title: Browser }
  api:     { kind: service, icon: nodejs, title: API, sub: ":3000" }
  db:      { kind: database, icon: postgresql, title: Database }
edges:
  - browser -> api: HTTPS
  - api -> db: { kind: data, label: SQL }
scenarios:
  load-page:
    title: Load a page
    steps:
      - browser -> api: GET /items
      - api -> db: { label: SELECT, kind: lookup }
      - db -> api: rows
      - api -> browser: 200 OK
```

## This repository

A monorepo. One place to change the tool, its documentation and its starter project together.

| | |
|---|---|
| `packages/core` | schema, compiler, layout, edge router, scenario timeline |
| `packages/react` | the diagram component and its styles |
| `packages/astro` | Astro integration and `<Diagram>` |
| `packages/cli` | the `idocs` command |
| `packages/create-idocs` | `npm create idocs` |
| `apps/docs` | the tool's landing page, guides and live examples |
| `templates/starter` | the project new users start from |

How these fit together, whether you need more repositories (no, not for the docs; optionally one for a GitHub template), and how to release: **[docs/REPOSITORIES.md](docs/REPOSITORIES.md)**. Design decisions and what is next: [docs/PLAN.md](docs/PLAN.md). Working on the tool, or using an agent to? [CLAUDE.md](CLAUDE.md).

```sh
pnpm install
pnpm dev             # docs site, http://localhost:4321
pnpm dev:template    # the starter project
pnpm test            # unit tests
pnpm test:e2e        # builds the docs and drives them in Chrome (needs Google Chrome)
pnpm verify:pack     # packs everything and installs it the way a user would
```

Requires Node 22+ and pnpm.
