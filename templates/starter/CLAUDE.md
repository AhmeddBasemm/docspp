# My docs

Documentation site built with [docspp](__DOCS_URL__): Astro + Starlight pages with architecture diagrams that readers can click and play.

## Commands

```sh
pnpm install
pnpm dev                    # http://localhost:4321
pnpm check [--json]         # validate every diagram (errors say file:line:col and suggest fixes)
pnpm build                  # static site in dist/
pnpm docspp new <name>       # new diagram folder
pnpm docspp list --json      # what diagrams, views and scenarios exist
pnpm docspp icons search <q> # find an icon name
```

## Where things are

- `diagrams/<name>/diagram.yaml`: one diagram (nodes, groups, edges, views, scenarios)
- `diagrams/<name>/nodes/<id>.md`: what a reader sees when they click that box
- `diagrams/<name>/scenarios/<id>.yaml`: a long scenario in its own file
- `src/content/docs/*.mdx`: the pages; embed a diagram with `<Diagram name="<name>" />`
- `src/styles/custom.css`: theme tokens (`--docspp-*`)

## Working on diagrams

Use the `author-diagram` skill (`.claude/skills/author-diagram`). Read the code you are documenting, write the YAML, then **always** run `pnpm check` and look at the rendered page before you finish. Never invent services, ports or flows.
