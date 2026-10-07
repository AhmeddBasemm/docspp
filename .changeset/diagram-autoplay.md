---
"@packagelab/docspp-react": minor
"@packagelab/docspp-astro": minor
"@packagelab/docspp-core": minor
"docspp": minor
"create-docspp": minor
---

Add an `autoplay` prop to `<Diagram>` and `<DiagramView>`. It plays the scenario given by `scenario` as soon as the diagram is laid out, and is ignored when the reader prefers reduced motion. `<Diagram>` also accepts `hash`, which `<DiagramView>` already had: `hash={false}` stops the diagram writing the scenario and step into the page address, which suits decorative embeds.

Fix icons going blank when the same logo appears twice on a page and the first copy is hidden (a tab that is not selected, "Hide planned"). Icon sets reuse gradient ids inside each logo, so the copies shared ids; every instance now has its own.

Fix the playback speed picker keeping the browser's text colour, which made it unreadable when a diagram's palette is dark on a light site (or the other way round).
