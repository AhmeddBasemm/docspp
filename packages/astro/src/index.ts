import { fileURLToPath } from 'node:url'
import { formatDiagnostic, type LoadedProject, loadProject } from '@docspp/core/node'
import type { AstroIntegration } from 'astro'
import type { Plugin } from 'vite'

const VIRTUAL_ID = 'virtual:docspp/diagrams'
const RESOLVED_ID = `\0${VIRTUAL_ID}`

export interface DocsppOptions {
  /** Folder with one sub-folder per diagram. Relative to the project root. Default `diagrams`. */
  dir?: string
}

/** Compiles `diagrams/*` into the `virtual:docspp/diagrams` module and fails the build on errors. */
export default function docspp(options: DocsppOptions = {}): AstroIntegration {
  return {
    name: '@docspp/astro',
    hooks: {
      'astro:config:setup': ({ config, updateConfig }) => {
        updateConfig({
          vite: {
            plugins: [plugin(fileURLToPath(config.root), options.dir ?? 'diagrams')],
            // Render these through Vite in dev as well; they ship TypeScript sources.
            ssr: { noExternal: ['@docspp/react', '@docspp/core', '@docspp/astro'] },
            optimizeDeps: {
              include: [
                '@docspp/react > d3-selection',
                '@docspp/react > d3-zoom',
                '@docspp/core > elkjs/lib/elk.bundled.js',
              ],
            },
          },
        })
      },
    },
  }
}

function plugin(root: string, dir: string): Plugin {
  let building = false
  let project: LoadedProject | undefined

  const load = () => {
    project = loadProject(root, dir)
    return project
  }

  return {
    name: 'docspp:diagrams',
    configResolved(config) {
      building = config.command === 'build'
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined
    },
    load(id) {
      if (id !== RESOLVED_ID) return undefined
      const p = load()
      const errors = p.diagnostics.filter((d) => d.severity === 'error')
      const report = p.diagnostics.map(formatDiagnostic).join('\n')
      if (errors.length && building) {
        this.error(`Diagram errors:\n${report}`)
      }
      if (p.diagnostics.length) this.warn(`docspp\n${report}`)
      for (const f of p.watch) this.addWatchFile(f)
      return `export const diagrams = ${JSON.stringify(p.diagrams)}\nexport const diagnostics = ${JSON.stringify(p.diagnostics)}\nexport default diagrams\n`
    },
    configureServer(server) {
      const base = loadProject(root, dir).watch[0]
      if (base) server.watcher.add(base)
      const onChange = (file: string) => {
        if (!base || !file.startsWith(base)) return
        // Astro renders on the server environment, the browser has its own graph; drop both.
        for (const env of Object.values(server.environments)) {
          const mod = env.moduleGraph.getModuleById(RESOLVED_ID)
          if (mod) env.moduleGraph.invalidateModule(mod)
        }
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('change', onChange)
      server.watcher.on('add', onChange)
      server.watcher.on('unlink', onChange)
    },
  }
}
