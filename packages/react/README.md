# @packagelab/docspp-react

`<DiagramView diagram={...} />`: the interactive diagram. Pan and zoom, a detail drawer, a scenario player with step list, a sequence view, and a camera that follows the action in large diagrams.

```tsx
import { DiagramView } from '@packagelab/docspp-react'
import '@packagelab/docspp-react/styles.css'
```

`diagram` is the output of `@packagelab/docspp-core/node`'s compiler. Most people use it through `@packagelab/docspp-astro`'s `<Diagram>`. Every colour and font is a CSS variable starting with `--docspp-`.
