// Builds the extension into dist/:
//   dist/extension.js    the extension host (CommonJS, `vscode` left external)
//   dist/webview/        the preview page's script and stylesheet
//   dist/icons/*.json    the Iconify sets, read on first use
// `--watch` rebuilds on change; `--production` minifies.
import { copyFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, context } from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'package.json'))
const watch = process.argv.includes('--watch')
const production = process.argv.includes('--production')

const common = {
  absWorkingDir: root,
  bundle: true,
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
}

const host = {
  ...common,
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['vscode'],
  // The compiler checks `process.env.NODE_ENV` in a few dependencies.
  define: { 'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development') },
}

const webview = {
  ...common,
  entryPoints: { main: 'webview/main.tsx' },
  outdir: 'dist/webview',
  platform: 'browser',
  format: 'iife',
  target: 'chrome120',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development') },
  loader: { '.svg': 'dataurl', '.woff2': 'dataurl' },
}

function copyIcons() {
  mkdirSync(join(root, 'dist/icons'), { recursive: true })
  for (const name of ['logos', 'simple-icons', 'lucide']) {
    copyFileSync(
      require.resolve(`@iconify-json/${name}/icons.json`),
      join(root, `dist/icons/${name}.json`),
    )
  }
}

// vsce packages the extension folder; npm and vsce both look for LICENSE there.
function copyLicense() {
  copyFileSync(join(root, '../../LICENSE'), join(root, 'LICENSE'))
}

if (!watch) rmSync(join(root, 'dist'), { recursive: true, force: true })
copyIcons()
copyLicense()

if (watch) {
  const contexts = await Promise.all([context(host), context(webview)])
  await Promise.all(contexts.map((c) => c.watch()))
  console.log('watching for changes')
} else {
  await Promise.all([build(host), build(webview)])
  console.log(`built ${JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).name}`)
}
