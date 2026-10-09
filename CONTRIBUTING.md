# Contributing to docspp

Thank you for wanting to help. Bug reports, fixes, documentation, new ideas and questions are all contributions, and all of them are welcome.

By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md). For security problems, do **not** open an issue: follow [SECURITY.md](SECURITY.md).

## Ways to help

- **Report a bug.** Use the [bug report form](https://github.com/AhmeddBasemm/docspp/issues/new?template=bug_report.yml). The most useful thing you can attach is the smallest `diagram.yaml` that shows the problem, plus the output of `pnpm docspp check --json`.
- **Suggest a feature.** Use the [feature request form](https://github.com/AhmeddBasemm/docspp/issues/new?template=feature_request.yml) and describe the diagram you are trying to draw. The problem matters more than the proposed solution.
- **Improve the docs.** The guides live in [`apps/docs/src/content/docs`](apps/docs/src/content/docs). Fixing a confusing sentence is a real contribution.
- **Fix something.** Look for issues labelled `good first issue` or `help wanted`. If nobody is assigned, say you are picking it up.

For anything bigger than a small fix, please open an issue first so we can agree on the approach before you spend the time. The design notes in [docs/PLAN.md](docs/PLAN.md) explain why things are the way they are.

## Set up

You need Node 22 or newer and [pnpm](https://pnpm.io). End-to-end tests also need Google Chrome.

```sh
git clone https://github.com/AhmeddBasemm/docspp.git
cd docspp
pnpm install
pnpm dev
```

`pnpm dev` serves the docs site at http://localhost:4321. It doubles as the playground: the live examples are `/examples/checkout/` and `/examples/platform/`.

pnpm refuses package releases that are very new (a minimum release age). If an install fails because of that, loosen the version range in the package you are editing. Please do not turn the policy off.

## Where things are

| Path | What it is |
|---|---|
| `packages/core` | schema, compiler, layout, edge router, scenario timeline, story model. No UI |
| `packages/react` | `DiagramView`, its parts and `styles.css` |
| `packages/astro` | the Astro integration and `<Diagram>` |
| `packages/cli` | the `docspp` command |
| `extensions/vscode` | the VS Code extension; see its [DEVELOPMENT.md](extensions/vscode/DEVELOPMENT.md) |
| `packages/create-docspp` | `npm create docspp` |
| `apps/docs` | landing page, guides, live examples and the end-to-end tests |
| `templates/starter` | the project new users start from |
| `skills/docspp` | the agent skill |

There is a longer tour, with the rationale for each rule below, in [CLAUDE.md](CLAUDE.md) and [docs/REPOSITORIES.md](docs/REPOSITORIES.md).

## Commands

```sh
pnpm dev               # docs site with hot reload
pnpm dev:template      # the starter project
pnpm test              # unit tests (vitest)
pnpm test:e2e          # builds the docs and drives them in Chrome
pnpm verify:pack       # packs everything and installs it like a user would (network + Chrome)
pnpm vscode:test       # the VS Code extension in a real VS Code (opens a window)
pnpm typecheck         # tsc everywhere
pnpm lint              # Biome; `pnpm format` fixes what it can
pnpm check             # validate the example diagrams in apps/docs and templates/starter
pnpm build:all         # packages, docs site and template
```

Restart `pnpm dev` after editing compile code in `packages/core`. Layout and renderer changes reload on their own.

## Making a change

1. Fork the repository and create a branch from `main`.
2. Make the change. Keep it focused: one concern per pull request.
3. Add or update tests. Behaviour changes need a test; layout changes are covered by the geometry tests in `packages/core`.
4. Run `pnpm lint`, `pnpm typecheck` and `pnpm test`. If you touched anything a reader sees or clicks, run `pnpm test:e2e` as well.
5. For a visual change, run `pnpm dev` and look at `/examples/checkout/` and `/examples/platform/` in both light and dark mode.
6. Add a changeset if users will notice the change (see below).
7. Open a pull request. The template lists what to confirm.

### Design rules

These keep the project working. A pull request that breaks one will be asked to change.

- **`@packagelab/docspp-core`'s main entry stays browser-safe.** Nothing reachable from `src/index.ts` may import `node:*`, `yaml`, `zod`, Iconify or unified. They belong behind `src/node.ts`.
- **The timeline and the story model are pure.** `buildTimeline`, `frameAt` and `buildStory` hold the logic; React components only draw. Add behaviour to the model with a test, not to a component.
- **Compiled output is JSON.** No functions, classes, Maps or Dates in `CompiledDiagram`: it crosses the server and client boundary as props.
- **Validate in the compiler, not the renderer.** A diagram that compiles must render. Error messages should name the file, line and column and suggest a fix.
- **Never leave `will-change: transform` on the zoomed layer.** It blurs everything when zoomed in.
- **Raw HTML in markdown is dropped on purpose.** Do not loosen that.
- **In the monorepo, `exports` point at TypeScript sources.** `publishConfig.exports` swaps in `dist/` when packing. Do not point `exports` at `dist/`.

### When you change the format or the CLI

- Update the guides in `apps/docs`.
- Update the skill in `skills/docspp` (edit it there, not through the `.claude/skills` symlink). A test compares it with the code and fails when they drift.
- If you changed the schema, regenerate the editor schemas. A test fails when they are stale:

  ```sh
  pnpm docspp schema apps/docs && pnpm docspp schema templates/starter
  ```

- The starter template is generated from `templates/starter`. Edit it there. Keep it minimal and free of tool documentation.

### Changesets

The five published packages are versioned together. For a user-visible change (a fix, a feature, a change in behaviour), run:

```sh
pnpm changeset
```

Pick the packages you changed, choose `patch`, `minor` or `major` (while we are on 0.x, breaking changes are `minor`), and write one sentence a user would understand. Commit the generated file in `.changeset/`. Changes to tests, docs, CI or internals need no changeset.

### Style

[Biome](https://biomejs.dev) decides formatting (single quotes, no semicolons, 100 columns); `pnpm format` applies it. Comments say why, not what. Prefer small pure functions in `core`, and keep UI state in `DiagramView`.

### Commits and pull requests

- Write the subject line in the imperative, under about 70 characters: "Fix edge routing around boxed-in nodes".
- Say why in the body when it is not obvious.
- Link the issue (`Fixes #123`).
- Keep pull requests small enough to review in one sitting, and mention anything you were unsure about.

Maintainers squash and merge, so your commit history inside a pull request does not need to be tidy.

## Releases

Maintainers release. In short: changesets accumulate on `main`, `pnpm changeset version` bumps the versions and writes the changelog, and `pnpm release` builds and publishes. The full checklist is in [docs/REPOSITORIES.md](docs/REPOSITORIES.md).

## Licensing

docspp is released under the [MIT License](LICENSE). By submitting a contribution you agree that it is licensed under the same terms, and that you have the right to submit it.

## Recognition

Contributors are listed in [CONTRIBUTORS.md](CONTRIBUTORS.md) and on the [contributors graph](https://github.com/AhmeddBasemm/docspp/graphs/contributors). Thank you.
