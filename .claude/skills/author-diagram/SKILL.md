---
name: author-diagram
description: Create or edit an interactive architecture diagram (diagrams/<name>/diagram.yaml) with nodes, groups, edges, views and playable scenarios. Use when asked to draw, document, update or explain a system, a request flow or a data path in this repo, or when a diagram fails `pnpm check`.
---

# Authoring diagrams

Diagrams live in `diagrams/<name>/diagram.yaml`. The tool lays them out, draws them, and plays scenarios over them. You write the model; never write coordinates.

## Workflow

1. **Look first.** `pnpm idocs list --json` shows what exists. Read the code you are documenting; do not invent components, ports or flows. Put the source files on the node as `refs:` so readers (and `pnpm check`) can tell when the diagram goes stale.
2. **Pick a scope.** One diagram answers one question ("how does checkout work?"). Aim for 8 to 25 nodes. Split anything bigger into views of one model, not several diagrams.
3. **Write the model**: nodes, then groups, then edges.
4. **Add scenarios** for the flows a reader will ask about: the happy path first, then the failures that teach something.
5. **Check**: `pnpm check --json`. Fix every error and every warning. Messages carry `file:line:column` and a suggestion.
6. **Look at it.** Run `pnpm dev`, open the page that embeds the diagram, and view it with a browser tool. Fix what you see (see "Layout" below). A diagram that validates can still be a mess.
7. Add the diagram to a page: `import Diagram from '@idocs/astro/Diagram.astro'` then `<Diagram name="<name>" />`.

Create a new one with `pnpm idocs new <name>` and run `pnpm idocs schema` once so editors validate the YAML.

## Format

```yaml
# yaml-language-server: $schema=../diagram.schema.json
title: Online store checkout
description: |            # markdown, shown above the diagram
  How a shopper's request travels.

groups:
  backend: { label: Backend, caption: Kubernetes }
  data:    { label: Data, in: backend }          # nested: dashed frame

nodes:
  browser: { kind: client, icon: react, title: Shopper browser }
  api:
    kind: service              # default icon and colour: see Kinds
    icon: nodejs               # bare name, logos:x, lucide:x, ./file.svg
    title: catalog-service
    sub: ":4001 · Node.js"     # mono line under the title
    lines: [products, prices]
    uses: [redis, postgres]
    status: planned            # built (default) | planned | legacy | optional
    in: backend
    refs: [services/catalog/server.ts]
  cache: { kind: cache, icon: redis, title: Redis, in: data }

edges:
  - browser -> api: HTTPS                              # shorthand
  - api <-> cache                                      # both directions
  - { from: api, to: db, kind: data, label: SQL, auth: password, payload: queries }
  - { from: api, to: audit, hidden: true }             # drawn only while a scenario uses it

views:                         # optional; default is one view with everything
  overview: { title: Overview, keys: true, interfaces: true }
  backend:  { title: Backend, include: [backend], direction: DOWN }

scenarios:
  cache-miss:
    title: Cache miss
    summary: Markdown. One or two sentences.
    phases:
      - title: The request
        steps:
          - browser -> api: GET /products/42          # multi-hop routes work: it follows edges
          - api -> cache: { label: GET product:42, kind: lookup }
          - cache -> api: { label: miss, kind: error }
          - at api: { label: SET product:42, note: Next request is a hit. }
          - par:
              - api -> db: SELECT
              - api -> metrics: emit
```

Node kinds: `client user ui external service gateway worker container function database cache storage queue agent network vm auth monitor`. Edge kinds: `http` (default) `channel` `tunnel` `queue` `ws` `data`, or define `edgeKinds:`. Step kinds: `request` (default) `response` `error` `lookup` `event`. A step that flies against an edge is a response automatically.

Click-through docs go in `diagrams/<name>/nodes/<id>.md` (markdown, tables and code fences render). Long scenarios can live in `diagrams/<name>/scenarios/<id>.yaml`.

## Layout

Layout is automatic. Steer it with hints, never with coordinates:

- **Order matters.** Declaration order decides order within a row and which edges point "backwards". Declare nodes in reading order.
- **`rows:`** on a group lays members out in explicit rows, top to bottom, each row spread across the width. Use it for stacks like gateway, services, stores:
  ```yaml
  mgmt:
    label: Management
    rows: [[proxy], [auth, api, backend], [shared]]
  ```
- **`layout: row | grid`** (with `columns:`) packs cards that need no arrows of their own, such as a row of data stores. Arrows to a member end on the group border.
- **`direction:`** on a view (`RIGHT`, `DOWN`) or a group; the default `AUTO` tries both.
- **`w:`** narrows or widens one card (default 178px). Narrow the cards in dense rows.
- **Too wide?** Fewer layers: merge hops, move rarely-linked nodes into packed groups, or hide relationships with `hidden: true`.
- Scenarios may use `hidden` edges, so relationships a scenario needs but the picture does not (service to queue, service to audit log) stay out of the way.

## Conventions

- Titles are the names people use in conversation; `sub` carries technical detail (port, stack).
- Edge labels are short: a protocol, a route, an event name. Put detail in `payload:` and `auth:`.
- Mark unbuilt work `status: planned`, not in prose. It draws dashed and the reader can hide it.
- Scenario steps: one verb per step, label what travels (`POST /orders`, `order.created`), use `note:` for the why. Group into 2 to 5 phases with plain titles ("Submit", "Charge", "Finish").
- Show failure paths as their own scenarios (`payment-declined`), not as notes.
- Do not restate the diagram in prose on the page; use the page to say what the diagram cannot.

## Commands

| | |
|---|---|
| `pnpm check [--json] [--strict]` | validate; `--strict` fails on warnings |
| `pnpm idocs list [--json]` | diagrams, views, scenarios |
| `pnpm idocs icons search <q>` | find an icon name |
| `pnpm idocs new <name>` | scaffold |
| `pnpm idocs schema` | write the JSON Schema for editors |
| `pnpm dev` | preview at http://localhost:4321 |

## Common errors

- `Edge from "x" is not a node`: typo or a node you have not declared; the hint suggests the nearest id.
- `No path from "a" to "b" in view "v"`: declare an edge between them (it can be `hidden: true`) or add `via: [...]`.
- `Node "x" is not in view "v"`: the scenario's view does not include it; add it to `include` or change the scenario's `view:`.
- `Unknown icon`: run `pnpm idocs icons search <name>`.
- YAML: quote values that contain `: ` or start with `{`, `[`, `*` or `&`; in `{ ... }` flow maps, quote values that contain commas.
