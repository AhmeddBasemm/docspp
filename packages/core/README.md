# @the-package-labs/idocs-core

The engine behind idocs: the diagram schema and compiler, group-by-group layout (ELK plus an orthogonal edge router), and the scenario timeline.

Three entry points:

- `@the-package-labs/idocs-core`: browser-safe. Types, `layoutView`, `routeEdges`, `buildTimeline`, `frameAt`.
- `@the-package-labs/idocs-core/browser`: browser and worker authoring. `compileDiagram(source, assets)`, `createIconResolver(iconSets)`, `RootSchema` and `normalizeRoot`. Supply icon sets from your host; this entry has no filesystem access. When bundling for a worker, include the `worker` resolve condition so Markdown uses its DOM-free decoder.
- `@the-package-labs/idocs-core/node`: Node only. `compileDiagram`, `loadProject`, the Zod schema, icon lookup, markdown.

You normally use it through [`@the-package-labs/idocs-astro`](../astro) and the [`idocs` CLI](../cli). See the repository README for the whole picture.
