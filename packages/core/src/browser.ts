// Browser-safe authoring entry. The host provides the bundled icon sets; no filesystem access.
export * from './compiler'
export { createIconResolver } from './icon-resolver'
export { normalizeRoot } from './normalize'
export { authoringJsonSchema, KNOWN_KEYS, type RootInput, RootSchema } from './schema'
