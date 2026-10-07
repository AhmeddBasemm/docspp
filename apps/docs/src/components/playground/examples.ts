export const examples = [
  {
    id: 'starter',
    label: 'Simple API',
    text: `# Edit the YAML, or click a node to edit it visually.
title: My first diagram

nodes:
  browser:
    title: Browser
    kind: client
  api:
    title: API
    kind: service
    sub: REST · port 3000
  database:
    title: Database
    kind: database
    icon: postgresql

edges:
  - browser -> api: HTTPS
  - api -> database: SQL
`,
  },
  {
    id: 'groups',
    label: 'Grouped services',
    text: `title: Photo uploads

groups:
  clients: { label: Clients, family: slate }
  backend: { label: Backend, family: blue, direction: RIGHT }
  stores: { label: Storage, family: green, layout: row }

nodes:
  web: { title: Web app, kind: ui, in: clients }
  api: { title: Upload API, kind: service, in: backend }
  queue: { title: Job queue, kind: queue, in: backend }
  worker: { title: Resizer, kind: worker, in: backend }
  db: { title: Metadata, kind: database, in: stores }
  bucket: { title: Photos, kind: storage, in: stores }

edges:
  - web -> api: Upload
  - api -> queue: Resize job
  - queue -> worker: Consume
  - api -> db: Save metadata
  - worker -> bucket: Store resized photo
`,
  },
  {
    id: 'scenario',
    label: 'Request playback',
    text: `title: A request, step by step

nodes:
  browser: { title: Browser, kind: client }
  api: { title: API, kind: service }
  cache: { title: Cache, kind: cache, icon: redis }
  db: { title: Database, kind: database, icon: postgresql }

edges:
  - browser -> api: HTTPS
  - api -> cache: Cache lookup
  - api -> db: SQL

scenarios:
  request:
    title: Read a profile
    steps:
      - browser -> api: GET /profile
      - api -> cache: Check cache
      - api -> db: Fetch profile
      - db -> api: Profile found
      - api -> browser: 200 OK
`,
  },
  { id: 'blank', label: 'Blank diagram', text: 'title: Untitled diagram\nnodes: {}\nedges: []\n' },
]
