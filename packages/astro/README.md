# @docspp/astro

Astro integration for docspp. It compiles `diagrams/` at build time (the build fails on a broken diagram) and provides the `<Diagram>` component.

```js
// astro.config.mjs
import react from '@astrojs/react'
import docspp from '@docspp/astro'

export default defineConfig({ integrations: [docspp(), react()] })
```

```mdx
import Diagram from '@docspp/astro/Diagram.astro'

<Diagram name="shop" scenario="checkout" />
```

Also exports `@docspp/astro/starlight.css`, which widens the Starlight content column for diagrams.
