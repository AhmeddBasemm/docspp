# @idocs/astro

Astro integration for idocs. It compiles `diagrams/` at build time (the build fails on a broken diagram) and provides the `<Diagram>` component.

```js
// astro.config.mjs
import react from '@astrojs/react'
import idocs from '@idocs/astro'

export default defineConfig({ integrations: [idocs(), react()] })
```

```mdx
import Diagram from '@idocs/astro/Diagram.astro'

<Diagram name="shop" scenario="checkout" />
```

Also exports `@idocs/astro/starlight.css`, which widens the Starlight content column for diagrams.
