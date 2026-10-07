# My docs

Interactive architecture docs, built with [docspp](__DOCS_URL__).

```sh
pnpm install
pnpm dev          # http://localhost:4321
```

Diagrams live in `diagrams/`, pages in `src/content/docs/`. Start with `diagrams/shop/diagram.yaml`, change a label, and save: the page reloads.

| | |
|---|---|
| `pnpm check` | validate diagrams |
| `pnpm docspp new <name>` | add a diagram |
| `pnpm build` | build the static site into `dist/` |

## Publish

Push to GitHub, open **Settings → Pages**, and choose **GitHub Actions** as the source. The workflow in `.github/workflows/deploy.yml` builds and publishes on every push to `main`.

## Update docspp

```sh
pnpm up "@docspp/*" --latest
```
