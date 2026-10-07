# docspp

A tool for documentation sites whose architecture diagrams are described in YAML, laid out automatically, and playable: a request can be shown travelling through the system, step by step, in several scenarios.

## Commands

```sh
pnpm install
pnpm dev               # docs site on http://localhost:4321
pnpm dev:template      # the starter project
pnpm build             # docs site to apps/docs/dist
pnpm build:packages    # compile the five packages into dist/
pnpm build:all         # packages + docs + template
pnpm test              # unit tests (vitest)
pnpm test:e2e          # builds the docs, drives them in Chrome (needs Google Chrome installed)
pnpm verify:pack       # pack, scaffold, install, build and load, like a user would (network + Chrome)
pnpm typecheck         # tsc everywhere (astro check does not support TypeScript 7)
pnpm lint              # biome; `pnpm format` fixes
pnpm check             # validate the example diagrams in apps/docs and templates/starter
pnpm docspp <command>   # the CLI: check, list, schema, icons search, new
pnpm changeset         # describe a change for the next release
```

Node >= 22, pnpm. `pnpm` refuses very new releases (minimum release age); if an install fails on that, loosen the range, do not disable the policy.

## Layout

```
packages/core           schema, compiler, layout, router, timeline. No UI.
  src/index.ts          browser-safe entry: types, layout, route, timeline, geometry
  src/node.ts           node-only entry: YAML parsing, Zod schema, compiler, icons, loader
packages/react          <DiagramView> and its parts, plus styles.css (all tokens are --docspp-*)
packages/astro          Astro integration (Vite plugin -> virtual:docspp/diagrams) and <Diagram>
packages/cli            `docspp`
packages/create-docspp   `npm create docspp`; carries a copy of the template, built by scripts/template.mjs
apps/docs               the tool's landing page, guides and live examples (+ e2e tests)
templates/starter       the minimal project users start from (source of truth for the template)
scripts/                build.mjs, template.mjs, verify-pack.mjs
```

Repository topology, the template repository and releasing: `docs/REPOSITORIES.md`.

## Rules that keep it working

- **`@packagelab/docspp-core` main entry must stay browser-safe.** No `node:*`, `yaml`, `zod`, Iconify or unified imports reachable from `src/index.ts`; they belong behind `src/node.ts`. The client bundle only gets layout, route, timeline and types.
- **The story model is pure too.** `buildStory(diagram, scenario)` in `core/src/story.ts` turns a scenario into lanes, boxes and links; `StoryView` only measures the DOM and draws connectors over it. Add behaviour to the model, with a test, not to the component.
- **The timeline is pure.** `buildTimeline(scenario, edgeLengths)` and `frameAt(timeline, t)` hold all playback logic; the React player is only a clock. Keep it that way: it makes scrubbing, stepping and tests trivial.
- **Never leave `will-change: transform` on the zoomed layer.** It makes the browser scale a bitmap, which blurs everything when zoomed in. `Canvas` sets it only while panning or zooming; an e2e test guards the resting state.
- **Compiled output is JSON.** `CompiledDiagram` crosses the server/client boundary as island props. No functions, classes, Maps or Dates in it.
- **Layout is group by group, bottom up** (see the comment at the top of `layout.ts`): flow groups use ELK, `rows` and `row/grid` groups are packed by us, zones are arranged by one more ELK run, and every edge ELK cannot see end to end goes through `route.ts`. Do not give ELK the whole hierarchy in one run; it forces one direction on everything.
- Heights come from the browser: `useLayout` renders cards offscreen at their fixed width, measures, then calls `layoutView`. Tests substitute fixed heights via `fakeSizes`.
- Validate in the compiler, not the renderer. A diagram that compiles must render.
- Raw HTML in markdown is dropped on purpose; compiled docs are injected with `dangerouslySetInnerHTML`.
- **In the monorepo `exports` point at TypeScript sources**; `publishConfig.exports` points at `dist/` and is applied by pnpm when packing. Do not point `exports` at `dist/`.
- **Changing the schema?** Run `pnpm docspp schema apps/docs && pnpm docspp schema templates/starter`; a test fails when the committed `diagram.schema.json` files are stale.
- **The template is generated.** Edit `templates/starter`, not a template repository. It must stay minimal and free of tool documentation. The `docspp` skill is maintained once in `skills/docspp/` (a test checks it against the code), linked from `.claude/skills/docspp` for this repo, copied into new projects, and installable by anyone with `npx skills add`.
- The five published packages are versioned together (changesets `fixed`). Add a changeset for any user-visible change.
- Dev-server gotcha: the Vite plugin loads the compiler once at startup, so restart `pnpm dev` after editing `packages/core` compile code (layout and renderer changes hot-reload).

## Style

Biome decides formatting (single quotes, no semicolons, 100 columns). Comments say why, not what. Prefer small pure functions in `core`; UI state lives in `DiagramView`.

## Testing a visual change

Unit tests cover geometry (no overlaps, edges end on borders, nothing crosses an unrelated node). For anything visual, run `pnpm dev`, open `/examples/checkout/` and `/examples/platform/`, and look at both themes. `pnpm test:e2e` covers playback, the drawer and the sequence view.

## Authoring diagrams

Use the `docspp` skill (`skills/docspp`, linked from `.claude/skills/docspp`). Always finish with `pnpm check`.
