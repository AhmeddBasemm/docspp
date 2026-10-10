import { join } from 'node:path'
import * as vscode from 'vscode'
import { iconSetsFromDir, lazyIconResolver } from './model/icons'
import { registerCommands } from './vscode/commands'
import { registerCompletion } from './vscode/completion'
import { registerHover } from './vscode/hover'
import { registerNavigation } from './vscode/navigation'
import { PreviewManager, type PreviewSnapshot } from './vscode/preview'
import { DiagramService } from './vscode/service'
import { StatusBar, type StatusSnapshot } from './vscode/status'
import { registerSymbols } from './vscode/symbols'

export interface IdocsApi {
  /** Resolves when every diagram in the workspace has been compiled once. */
  ready: Promise<void>
  /** Absolute paths of the diagrams found so far. */
  diagrams(): string[]
  /** The state of the preview panel, for tests. */
  preview(): PreviewSnapshot
  /** The status bar entry, for tests. */
  status(): StatusSnapshot
}

export function activate(context: vscode.ExtensionContext): IdocsApi {
  const output = vscode.window.createOutputChannel('idocs', { log: true })
  // The icon sets are 12 MB of JSON: they are read when the first icon is looked up, not now.
  const icons = lazyIconResolver(() =>
    iconSetsFromDir(join(context.extensionPath, 'dist', 'icons')),
  )

  const service = new DiagramService(icons, output)
  const preview = new PreviewManager(context, service)
  const status = new StatusBar(service)

  context.subscriptions.push(
    output,
    service,
    preview,
    status,
    registerCompletion(service),
    registerHover(service),
    registerSymbols(service),
    ...registerNavigation(service),
    ...registerCommands(service, preview, output),
  )

  const ready = service
    .discover()
    .then(() => undefined)
    .catch((error) => output.error('discovery failed', error as Error))
  return {
    ready,
    diagrams: () => service.folders,
    preview: () => preview.snapshot(),
    status: () => status.current,
  }
}

export function deactivate(): void {}
