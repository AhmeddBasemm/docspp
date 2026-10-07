# @packagelab/docspp-core

The engine behind docspp: the diagram schema and compiler, group-by-group layout (ELK plus an orthogonal edge router), and the scenario timeline.

Three entry points:

- `@packagelab/docspp-core`: browser-safe. Types, `layoutView`, `routeEdges`, `buildTimeline`, `frameAt`.
- `@packagelab/docspp-core/browser`: browser and worker authoring. `compileDiagram(source, assets)`, `createIconResolver(iconSets)`, `RootSchema` and `normalizeRoot`. Supply icon sets from your host; this entry has no filesystem access. When bundling for a worker, include the `worker` resolve condition so Markdown uses its DOM-free decoder.
- `@packagelab/docspp-core/node`: Node only. `compileDiagram`, `loadProject`, the Zod schema, icon lookup, markdown.

You normally use it through [`@packagelab/docspp-astro`](../astro) and the [`docspp` CLI](../cli). See the repository README for the whole picture.
