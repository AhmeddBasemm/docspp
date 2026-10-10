// The files `idocs new <name>` creates. packages/cli writes the same text; test/scaffold.test.ts
// runs the CLI and compares, so the two cannot drift apart.
export const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/

export interface ScaffoldFile {
  /** Relative to the diagram folder. */
  path: string
  content: string
}

export function newDiagramFiles(name: string): ScaffoldFile[] {
  return [
    { path: 'diagram.yaml', content: diagramTemplate(name) },
    {
      path: 'nodes/api.md',
      content:
        'Describe the API here. Markdown is shown in the detail drawer when a reader clicks the box.\n',
    },
  ]
}

const diagramTemplate = (name: string) => `# yaml-language-server: $schema=../diagram.schema.json
title: ${name}

nodes:
  web:
    kind: client
    title: Web app
  api:
    kind: service
    title: API
    sub: ":8080"
  db:
    kind: database
    icon: postgresql
    title: Database

edges:
  - web -> api: HTTPS
  - api -> db: { kind: data, label: SQL }

scenarios:
  load-page:
    title: Load a page
    steps:
      - web -> api: GET /items
      - api -> db: { label: SELECT, kind: lookup }
      - db -> api: rows
      - api -> web: 200 OK
`
