import type { FromWebview } from '../src/preview/protocol'

interface Api {
  postMessage(message: FromWebview): void
  getState(): unknown
  setState(state: unknown): void
}

declare function acquireVsCodeApi(): Api

// `acquireVsCodeApi` may be called once per page.
export const vscode = acquireVsCodeApi()
