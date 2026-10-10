import { BUILTIN_KINDS } from '@the-package-labs/idocs-core'
import { resolveIcon } from '@the-package-labs/idocs-core/node'

/** Start quickly with built-in kinds and common stack icons; the full catalog is loaded on demand. */
export function GET() {
  const specs = new Set([
    ...Object.values(BUILTIN_KINDS).map((kind) => kind.icon),
    'postgresql',
    'postgres',
    'pg',
    'redis',
    'mysql',
    'mongodb',
    'mongo',
    'docker',
    'kubernetes',
    'k8s',
    'nodejs',
    'node',
    'typescript',
    'ts',
    'javascript',
    'js',
    'python',
    'go',
    'react',
    'nginx',
    'rabbitmq',
    'rabbit',
    'kafka',
    'keycloak',
    'dotnet',
    '.net',
    'elasticsearch',
    'elastic',
    'es',
    'aws',
    'stripe',
  ])
  const icons = Object.fromEntries(
    [...specs].flatMap((spec) => {
      const icon = resolveIcon(spec).icon
      return icon ? [[spec, icon]] : []
    }),
  )
  return new Response(JSON.stringify(icons), { headers: { 'Content-Type': 'application/json' } })
}
