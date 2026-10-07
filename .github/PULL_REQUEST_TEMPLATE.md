## What and why

<!-- What does this change, and what problem does it solve? Link the issue if there is one. -->

## How it was tested

<!-- Commands you ran, and what you looked at in the browser for visual changes. -->

## Checklist

- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass
- [ ] `pnpm test:e2e` passes (needed for anything the reader sees or clicks)
- [ ] Behaviour changes have a test; layout changes were checked in light and dark mode
- [ ] Docs in `apps/docs` and the skill in `skills/docspp` are updated if the format or CLI changed
- [ ] `diagram.schema.json` files are regenerated if the schema changed (`pnpm docspp schema apps/docs && pnpm docspp schema templates/starter`)
- [ ] A changeset was added for user-visible changes (`pnpm changeset`)
