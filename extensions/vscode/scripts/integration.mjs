// Runs integration/suite.ts inside a real VS Code with the extension loaded, against a copy of
// integration/fixture. It opens a VS Code window for the duration of the run.
//
//   node scripts/integration.mjs          load the extension from this folder, as F5 does
//   node scripts/integration.mjs --vsix   pack it, install the .vsix into a clean profile and test
//                                         that, so a file missing from the package fails here
//
// Uses the VS Code that is installed (or VSCODE_EXECUTABLE); otherwise downloads one into
// .vscode-test. If you start this from a VS Code terminal, unset ELECTRON_RUN_AS_NODE first.
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  downloadAndUnzipVSCode,
  resolveCliArgsFromVSCodeExecutablePath,
  runTests,
} from '@vscode/test-electron'
import { build } from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packed = process.argv.includes('--vsix')

if (process.env.ELECTRON_RUN_AS_NODE) {
  console.error(
    'ELECTRON_RUN_AS_NODE is set, so VS Code would start as plain Node. Unset it and retry.',
  )
  process.exit(1)
}

execFileSync('node', [packed ? 'scripts/package.mjs' : 'scripts/build.mjs'], {
  cwd: root,
  stdio: 'inherit',
})
await build({
  absWorkingDir: root,
  entryPoints: ['integration/suite.ts'],
  outfile: 'dist/integration/suite.js',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['vscode'],
  logLevel: 'warning',
})

const scratch = mkdtempSync(join(tmpdir(), 'idocs-integration-'))
const workspace = join(scratch, 'workspace')
cpSync(join(root, 'integration/fixture'), workspace, { recursive: true })

const installed = [
  process.env.VSCODE_EXECUTABLE,
  '/Applications/Visual Studio Code.app/Contents/MacOS/Code',
  '/usr/share/code/code',
].find((p) => p && existsSync(p))
const vscodeExecutablePath = installed ?? (await downloadAndUnzipVSCode('stable'))

const common = [
  '--disable-workspace-trust',
  '--skip-welcome',
  '--skip-release-notes',
  '--disable-telemetry',
]
let extensionDevelopmentPath = root
let launchArgs = [workspace, ...common, '--disable-extensions']

if (packed) {
  const extensionsDir = join(scratch, 'extensions')
  const userDataDir = join(scratch, 'user-data')
  const profile = ['--extensions-dir', extensionsDir, '--user-data-dir', userDataDir]
  const { name, version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const [cli, ...cliArgs] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath)
  const install = spawnSync(
    cli,
    [
      ...cliArgs,
      '--install-extension',
      join(root, `${name}-${version}.vsix`),
      '--force',
      ...profile,
    ],
    { encoding: 'utf8' },
  )
  if (install.status !== 0) {
    console.error(install.stdout, install.stderr)
    process.exit(1)
  }
  // The test runner needs a development folder; an empty extension stands in so that the real one
  // is loaded from the profile it was installed into.
  extensionDevelopmentPath = join(scratch, 'host')
  mkdirSync(extensionDevelopmentPath)
  writeFileSync(
    join(extensionDevelopmentPath, 'package.json'),
    JSON.stringify({
      name: 'idocs-test-host',
      version: '0.0.0',
      publisher: 'idocs-test',
      engines: { vscode: '^1.90.0' },
    }),
  )
  launchArgs = [workspace, ...common, ...profile]
}

try {
  await runTests({
    vscodeExecutablePath,
    extensionDevelopmentPath,
    extensionTestsPath: join(root, 'dist/integration/suite.js'),
    launchArgs,
  })
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
