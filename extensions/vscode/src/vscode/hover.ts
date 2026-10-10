import * as vscode from 'vscode'
import { hover } from '../language/hover'
import type { DiagramService } from './service'

export function registerHover(service: DiagramService): vscode.Disposable {
  return vscode.languages.registerHoverProvider(
    { language: 'idocs', scheme: 'file' },
    {
      provideHover(document, position) {
        const where = service.locate(document.uri)
        if (!where || (where.role !== 'diagram' && where.role !== 'scenario')) return undefined
        const model = service.model(document.uri.fsPath, where)
        if (!model) return undefined
        // Names and declarations always come from the diagram file, even when hovering a scenario.
        const main = service.mainFile(where.folder)
        const declarations = (main ? service.model(main)?.declarations : undefined) ?? []

        const result = hover({
          parsed: model.parsed,
          position: { line: position.line, character: position.character },
          file: where.role,
          declarations,
          refs: model.refs,
          diagram: service.state(where.folder)?.lastGood,
          resolveIcon: (spec) => service.icons.resolveIcon(spec).icon,
        })
        if (!result) return undefined

        const markdown = new vscode.MarkdownString(result.markdown)
        markdown.supportHtml = false
        return new vscode.Hover(
          markdown,
          new vscode.Range(
            result.span.start.line,
            result.span.start.character,
            result.span.end.line,
            result.span.end.character,
          ),
        )
      },
    },
  )
}
