import '@packagelab/docspp-react/styles.css'
import './theme.css'
import { createRoot } from 'react-dom/client'
import { App } from './App'

/** VS Code puts its theme kind on <body> as a class; docspp reads it from <html data-theme>. */
function syncTheme() {
  const classes = document.body.classList
  const dark = classes.contains('vscode-dark') || classes.contains('vscode-high-contrast')
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}
syncTheme()
new MutationObserver(syncTheme).observe(document.body, {
  attributes: true,
  attributeFilter: ['class'],
})

const root = document.getElementById('root')
if (root) createRoot(root).render(<App />)
