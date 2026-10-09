// The page the preview webview loads. Scripts need the nonce; nothing else may run, load or
// connect: the diagram arrives as a message, and its icons are inline SVG.
export interface PreviewHtmlOptions {
  nonce: string
  cspSource: string
  script: string
  style: string
  title: string
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function previewHtml({
  nonce,
  cspSource,
  script,
  style,
  title,
}: PreviewHtmlOptions): string {
  const csp = [
    "default-src 'none'",
    // React and d3 set inline styles on elements; scripts stay locked to the nonce.
    `style-src ${cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
    `img-src ${cspSource} data:`,
    `font-src ${cspSource}`,
  ].join('; ')
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="${escapeHtml(style)}" />
  <title>${escapeHtml(title)}</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${escapeHtml(script)}"></script>
</body>
</html>
`
}

export function makeNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < 32; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}
