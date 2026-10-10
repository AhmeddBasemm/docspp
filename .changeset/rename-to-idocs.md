---
'@packagelab/idocs-core': minor
'@packagelab/idocs-react': minor
'@packagelab/idocs-astro': minor
'idocs': minor
'create-idocs': minor
---

docspp is now **idocs**, and its home is [github.com/The-Package-Labs/idocs](https://github.com/The-Package-Labs/idocs). The diagram format is unchanged; only names change. To move a project over:

- Replace the packages: `@packagelab/docspp-core`, `-react` and `-astro` become `@packagelab/idocs-core`, `-react` and `-astro`; the `docspp` CLI becomes `idocs`; `npm create docspp` becomes `npm create idocs`. Update `package.json`, the imports in `astro.config.mjs` and MDX pages, the `/// <reference types="@packagelab/idocs-astro/virtual" />` line and any `pnpm docspp` scripts.
- Rename CSS overrides: the tokens are `--idocs-*` and the classes `.idocs` and `.idocs-*`.
- Reinstall the agent skill with `npx skills add The-Package-Labs/idocs --skill idocs`; it is now called `idocs`.
- Run `pnpm idocs schema` to rewrite `diagrams/diagram.schema.json`.
