# interactive-docs

A template for documentation sites whose architecture diagrams are described in YAML, laid out automatically, and playable: a request can be shown travelling through the system, step by step, in several scenarios.

## Commands

```sh
pnpm install
pnpm dev               # starter site on http://localhost:4321
pnpm build             # static site to apps/starter/dist
pnpm test              # unit tests (vitest)
pnpm test:e2e          # builds the starter, drives it in Chrome (needs Google Chrome installed)
pnpm typecheck         # tsc everywhere (astro check does not support TypeScript 7)
pnpm lint              # biome; `pnpm format` fixes
pnpm check             # validate the example diagrams
pnpm idocs <command>   # the CLI: check, list, schema, icons search, new
```

Node >= 22, pnpm. `pnpm` refuses very new releases (minimum release age); if an install fails on that, loosen the range, do not disable the policy.

## Layout

```
packages/core    schema, compiler, layout, router, timeline. No UI.
  src/index.ts   browser-safe entry: types, layout, route, timeline, geometry
  src/node.ts    node-only entry: YAML parsing, Zod schema, compiler, icons, loader
packages/react   <DiagramView> and its parts, plus styles.css (all tokens are --idocs-*)
packages/astro   Astro integration (Vite plugin -> virtual:idocs/diagrams) and <Diagram>
packages/cli     `idocs`
apps/starter     Astro + Starlight site: the template users copy
  diagrams/      checkout (small), platform (large), hello (docs)
```

## Rules that keep it working

- **`@idocs/core` main entry must stay browser-safe.** No `node:*`, `yaml`, `zod`, Iconify or unified imports reachable from `src/index.ts`; they belong behind `src/node.ts`. The client bundle only gets layout, route, timeline and types.
- **The timeline is pure.** `buildTimeline(scenario, edgeLengths)` and `frameAt(timeline, t)` hold all playback logic; the React player is only a clock. Keep it that way: it makes scrubbing, stepping and tests trivial.
- **Compiled output is JSON.** `CompiledDiagram` crosses the server/client boundary as island props. No functions, classes, Maps or Dates in it.
- **Layout is group by group, bottom up** (see the comment at the top of `layout.ts`): flow groups use ELK, `rows` and `row/grid` groups are packed by us, zones are arranged by one more ELK run, and every edge ELK cannot see end to end goes through `route.ts`. Do not give ELK the whole hierarchy in one run; it forces one direction on everything.
- Heights come from the browser: `useLayout` renders cards offscreen at their fixed width, measures, then calls `layoutView`. Tests substitute fixed heights via `fakeSizes`.
- Validate in the compiler, not the renderer. A diagram that compiles must render.
- Raw HTML in markdown is dropped on purpose; compiled docs are injected with `dangerouslySetInnerHTML`.

## Style

Biome decides formatting (single quotes, no semicolons, 100 columns). Comments say why, not what. Prefer small pure functions in `core`; UI state lives in `DiagramView`.

## Testing a visual change

Unit tests cover geometry (no overlaps, edges end on borders, nothing crosses an unrelated node). For anything visual, run `pnpm dev`, open `/examples/checkout/` and `/examples/platform/`, and look at both themes. `pnpm test:e2e` covers playback, the drawer and the sequence view.

## Authoring diagrams

Use the `author-diagram` skill (`.claude/skills/author-diagram`). Always finish with `pnpm check`.
