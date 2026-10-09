// What the preview page and the test harness put on `window`.
interface Window {
  /** Messages the webview posted to the extension, collected by the harness. */
  __sent: unknown[]
  /** What the webview saved with `setState`. */
  __state?: unknown
  acquireVsCodeApi?: () => {
    postMessage(message: unknown): void
    getState(): unknown
    setState(state: unknown): void
  }
}
