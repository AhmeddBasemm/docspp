import { loadIconSets } from '@the-package-labs/idocs-core/node'

export function GET() {
  return new Response(JSON.stringify(loadIconSets()), {
    headers: { 'Content-Type': 'application/json' },
  })
}
