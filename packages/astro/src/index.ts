import { fileURLToPath } from 'node:url'
import {
  formatDiagnostic,
  type LoadedProject,
  loadProject,
} from '@the-package-labs/idocs-core/node'
import type { AstroIntegration } from 'astro'
import type { Plugin } from 'vite'

const VIRTUAL_ID = 'virtual:idocs/diagrams'
const RESOLVED_ID = `\0${VIRTUAL_ID}`

export interface IdocsOptions {
  /** Folder with one sub-folder per diagram. Relative to the project root. Default `diagrams`. */
  dir?: string
}

/** Compiles `diagrams/*` into the `virtual:idocs/diagrams` module and fails the build on errors. */
export default function idocs(options: IdocsOptions = {}): AstroIntegration {
  return {
    name: '@the-package-labs/idocs-astro',
    hooks: {
      'astro:config:setup': ({ config, updateConfig }) => {
        updateConfig({
          vite: {
            plugins: [plugin(fileURLToPath(config.root), options.dir ?? 'diagrams')],
            // Render these through Vite in dev as well; they ship TypeScript sources.
            ssr: {
              noExternal: [
                '@the-package-labs/idocs-react',
                '@the-package-labs/idocs-core',
                '@the-package-labs/idocs-astro',
              ],
            },
            // Vite resolves `a > b` by finding `a` from the project root, and a strict layout (pnpm)
            // only shows it what the project lists. Every chain therefore starts at this package,
            // the one thing the project is sure to depend on, and walks down to the library.
            optimizeDeps: {
              include: [
                '@the-package-labs/idocs-astro > @the-package-labs/idocs-react > d3-selection',
                '@the-package-labs/idocs-astro > @the-package-labs/idocs-react > d3-transition',
                '@the-package-labs/idocs-astro > @the-package-labs/idocs-react > d3-zoom',
                '@the-package-labs/idocs-astro > @the-package-labs/idocs-core > elkjs/lib/elk.bundled.js',
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
    name: 'idocs:diagrams',
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
      if (p.diagnostics.length) this.warn(`idocs\n${report}`)
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
