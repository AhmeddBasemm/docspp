# @packagelab/idocs-react

`<DiagramView diagram={...} />`: the interactive diagram. Pan and zoom, a detail drawer, a scenario player with step list, a sequence view, and a camera that follows the action in large diagrams.

```tsx
import { DiagramView } from '@packagelab/idocs-react'
import '@packagelab/idocs-react/styles.css'
```

`diagram` is the output of `@packagelab/idocs-core/node`'s compiler. Most people use it through `@packagelab/idocs-astro`'s `<Diagram>`. Every colour and font is a CSS variable starting with `--idocs-`.

For visual editors, pass `onNodeSelect={(id) => ...}` to handle node clicks in your inspector, and `selectedNode={id}` to control the highlighted node. Supplying `onNodeSelect` replaces the built-in detail drawer.
