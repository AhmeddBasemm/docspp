# Interactive docs

Describe your system in YAML. Get architecture diagrams your readers can click, filter and **play**: pick a scenario and watch a request travel through the system, step by step.

- **Declarative.** Nodes, groups and edges in `diagram.yaml`. No coordinates; layout is automatic and steerable with a few hints.
- **Scenarios.** A diagram has any number of them: the happy path, a cache miss, a declined card. Each plays as packets over the architecture or as a sequence diagram, with a step list, scrubbing, speed control and shareable deep links.
- **One model, many views.** Write a node once; show it in an overview, a backend-only view, a per-team view.
- **Docs inside the picture.** Click a box for its markdown, connections and source references. Edge keys link to an interfaces table that is generated from the model.
- **Icons.** Brand logos for your stack (`postgresql`, `redis`, `keycloak`...), Lucide for the rest, your own SVGs if you like. All bundled at build time.
- **A real docs site.** Astro + Starlight: markdown pages, search, light and dark themes, static output for GitHub Pages.
- **Written to be generated.** A JSON Schema for the editor, a CLI whose errors say `file:line:col` and suggest fixes, and a Claude Code skill that knows the format.

## Use it

1. Click **Use this template** on GitHub, then clone your copy.
2. `pnpm install && pnpm dev`
3. Edit `apps/starter/diagrams/`, add pages under `apps/starter/src/content/docs/`.
4. `pnpm check` to validate, `pnpm build` for the static site.

Enable GitHub Pages with the **GitHub Actions** source and the included workflow publishes on every push to `main`.

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

The site's own pages document the format in full: start at **Guides** once it is running. [docs/PLAN.md](docs/PLAN.md) records the design decisions and what comes next. Working on the tool itself? See [CLAUDE.md](CLAUDE.md).

## Repository

| | |
|---|---|
| `packages/core` | schema, compiler, layout, edge router, scenario timeline |
| `packages/react` | the diagram component and its styles |
| `packages/astro` | Astro integration and `<Diagram>` |
| `packages/cli` | the `idocs` command |
| `apps/starter` | the site you copy: pages and example diagrams |

Requires Node 22+ and pnpm.
