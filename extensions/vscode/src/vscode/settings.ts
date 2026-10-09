import * as vscode from 'vscode'

export interface Settings {
  diagnostics: boolean
  /** Milliseconds to wait after typing before recompiling. */
  updateDelay: number
  /** Update the preview as you type, or only when the file is saved. */
  refreshOn: 'type' | 'save'
  followCursor: boolean
}

export function settings(): Settings {
  const c = vscode.workspace.getConfiguration('docspp')
  return {
    diagnostics: c.get('diagnostics.enable', true),
    updateDelay: Math.max(0, c.get('updateDelay', 250)),
    refreshOn: c.get<'type' | 'save'>('preview.refreshOn', 'type'),
    followCursor: c.get('preview.followCursor', true),
  }
}
