# @packagelab/idocs-astro

Astro integration for idocs. It compiles `diagrams/` at build time (the build fails on a broken diagram) and provides the `<Diagram>` component.

```js
// astro.config.mjs
import react from '@astrojs/react'
import idocs from '@packagelab/idocs-astro'

export default defineConfig({ integrations: [idocs(), react()] })
```

```mdx
import Diagram from '@packagelab/idocs-astro/Diagram.astro'

<Diagram name="shop" scenario="checkout" />
```

Also exports `@packagelab/idocs-astro/starlight.css`, which widens the Starlight content column for diagrams.
