# @docspp/core

The engine behind docspp: the diagram schema and compiler, group-by-group layout (ELK plus an orthogonal edge router), and the scenario timeline.

Two entry points:

- `@docspp/core`: browser-safe. Types, `layoutView`, `routeEdges`, `buildTimeline`, `frameAt`.
- `@docspp/core/node`: Node only. `compileDiagram`, `loadProject`, the Zod schema, icon lookup, markdown.

You normally use it through [`@docspp/astro`](../astro) and the [`docspp` CLI](../cli). See the repository README for the whole picture.
