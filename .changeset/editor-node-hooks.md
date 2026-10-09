---
"@packagelab/docspp-react": minor
"@packagelab/docspp-core": minor
---

`DiagramView` gains `onNodeOpen` (called when a node is clicked, without replacing the drawer) and `highlightNode` (outlines a node from outside, for editors that follow the cursor). The browser-safe authoring entry of `@packagelab/docspp-core` now also exports `authoringJsonSchema` and `KNOWN_KEYS`, which the VS Code extension uses for completion.

An "Unknown key" error now points at the unknown key itself instead of the node, group or step that holds it, so `docspp check` and editors underline the right word.

The compiler reports an alias whose anchor does not exist as an error instead of throwing, so `docspp check` no longer crashes on a half-written file. `DiagramView` hides the full-screen button where the page is not allowed to go full screen (such as an iframe without the permission), and ignores a `highlightNode` that is not in the current view.
