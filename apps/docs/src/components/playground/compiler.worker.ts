import type { IconData } from '@packagelab/idocs-core'
import {
  type CompilerAssets,
  compileDiagram,
  createIconResolver,
} from '@packagelab/idocs-core/browser'

let starterAssets: Promise<CompilerAssets> | undefined
let fullAssets: Promise<CompilerAssets> | undefined

async function fetchCatalog(url: string) {
  const response = await fetch(url)
  if (!response.ok)
    throw new Error('Could not load the icon catalog. Check your connection and try again.')
  return response.json()
}

self.onmessage = async ({
  data,
}: MessageEvent<{
  revision: number
  text: string
  iconsUrl: string
  starterIconsUrl: string
}>) => {
  const { revision, text, iconsUrl, starterIconsUrl } = data
  try {
    starterAssets ??= fetchCatalog(starterIconsUrl)
      .then((icons: Record<string, IconData>) => ({
        resolveIcon: (spec: string) => {
          const key = spec.includes(':') ? spec.trim() : spec.trim().toLowerCase()
          return { icon: Object.hasOwn(icons, key) ? icons[key] : undefined, suggestions: [] }
        },
      }))
      .catch((error) => {
        starterAssets = undefined
        throw error
      })
    const source = { name: 'playground', file: 'diagram.yaml', text }
    let result = compileDiagram(source, await (fullAssets ?? starterAssets))
    if (!fullAssets && result.diagnostics.some((d) => d.message.startsWith('Unknown icon'))) {
      fullAssets = fetchCatalog(iconsUrl)
        .then(createIconResolver)
        .catch((error) => {
          fullAssets = undefined
          throw error
        })
      result = compileDiagram(source, await fullAssets)
    }
    self.postMessage({ revision, text, ...result })
  } catch (error) {
    self.postMessage({
      revision,
      text,
      diagnostics: [
        {
          severity: 'error',
          file: 'diagram.yaml',
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    })
  }
}
