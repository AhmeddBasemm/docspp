import { loadIconSets } from '@packagelab/docspp-core/node'

export function GET() {
  return new Response(JSON.stringify(loadIconSets()), {
    headers: { 'Content-Type': 'application/json' },
  })
}
