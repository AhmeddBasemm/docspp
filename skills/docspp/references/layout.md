# Layout

Layout is automatic, and you steer it with hints, never with coordinates. If a diagram looks wrong, change the model or add a hint, then look again.

## How it works, briefly

Each top-level group (a **zone**) is laid out on its own, in whichever of left-to-right or top-to-bottom comes out squarer. Zones and ungrouped nodes are then arranged side by side. Edges that cross between zones are routed afterwards around the boxes. Two things follow:

- **Declaration order matters.** It decides the order of cards within a layer and which edges count as "backwards". Declare nodes in reading order: entry points first, stores last.
- **Zones are the unit of layout.** Group related nodes into zones (`groups:`) so they travel together.

## The hints

| Hint | Use it for |
|---|---|
| `rows: [[a], [b, c], [d]]` on a group | A stack you want exactly as drawn: gateway, then services, then stores. Each row is spread across the zone's width. Members must be direct children. |
| `layout: row` or `layout: grid` (with `columns:`) on a group | Cards that need no arrows of their own, such as a row of data stores or a grid of services. Arrows to a member end on the group's border. |
| `direction: DOWN` or `RIGHT` on a view | Force the main direction. The default `AUTO` tries both and keeps the one that reads larger. |
| `direction:` on a top-level group | Force the flow direction inside one zone. |
| `w: 132` on a node | A narrower or wider card (default 178). Narrow the cards in dense rows so a row of five stores does not make the zone huge. |
| `hidden: true` on an edge | Keep a relationship out of the picture but available to scenarios (service to queue, service to audit log). |
| A second `view` with `include:` | Show a slice: the backend only, one team's part, one device. |

## Symptoms and fixes

| You see | Try |
|---|---|
| The whole diagram is tiny at default zoom | Too much in one picture. Move detail into a second view, hide minor edges, or split the system. Aim for 8 to 25 nodes. |
| One zone is much wider than the rest | A long row of cards. Narrow them with `w:`, use `layout: grid` with `columns: 2` or `3`, or wrap with `rows:`. |
| Arrows cross all over | Reorder the nodes so the flow reads one way. Move cards that many things connect to into a packed group (`layout: row`) with a `uses:` tag instead of drawing every edge. |
| A zone is tall and thin | Set its `direction: RIGHT`, or break a long chain with `rows:`. |
| Two cards should sit side by side but do not | Put them in one `rows:` row. |
| An arrow stops at a group border instead of the card | That is how packed groups (`row`, `grid`) work. Put the connected cards in a `flow` group or a `rows` group. |
| Planned work clutters the picture | Mark it `status: planned`. Readers get a "Hide planned" toggle. |
| Labels overlap | Shorten them; move detail into `payload:` and `auth:`. |

## When to stop adjusting

If a diagram needs more than a few hints, the model is probably too big for one picture. Split it into views of the same model, or into two diagrams, before reaching for more hints.
