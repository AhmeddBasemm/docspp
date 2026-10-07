# @idocs/core

The engine behind idocs: the diagram schema and compiler, group-by-group layout (ELK plus an orthogonal edge router), and the scenario timeline.

Two entry points:

- `@idocs/core`: browser-safe. Types, `layoutView`, `routeEdges`, `buildTimeline`, `frameAt`.
- `@idocs/core/node`: Node only. `compileDiagram`, `loadProject`, the Zod schema, icon lookup, markdown.

You normally use it through [`@idocs/astro`](../astro) and the [`idocs` CLI](../cli). See the repository README for the whole picture.
