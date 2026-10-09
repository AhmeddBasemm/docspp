import * as vscode from 'vscode'
import { type OutlineKind, type OutlineSymbol, outline } from '../model/symbols'
import type { Span } from '../model/yaml'
import type { DiagramService } from './service'

const KINDS: Record<OutlineKind, vscode.SymbolKind> = {
  section: vscode.SymbolKind.Namespace,
  node: vscode.SymbolKind.Class,
  group: vscode.SymbolKind.Package,
  edge: vscode.SymbolKind.Event,
  view: vscode.SymbolKind.Struct,
  scenario: vscode.SymbolKind.Function,
  phase: vscode.SymbolKind.Namespace,
  step: vscode.SymbolKind.Method,
  kind: vscode.SymbolKind.TypeParameter,
}

export const toRange = (s: Span) =>
  new vscode.Range(s.start.line, s.start.character, s.end.line, s.end.character)

export function registerSymbols(service: DiagramService): vscode.Disposable {
  return vscode.languages.registerDocumentSymbolProvider(
    { language: 'docspp', scheme: 'file' },
    {
      provideDocumentSymbols(document) {
        const where = service.locate(document.uri)
        if (!where || (where.role !== 'diagram' && where.role !== 'scenario')) return undefined
        const model = service.model(document.uri.fsPath, where)
        return model ? outline(model.parsed, where.role).map(convert) : undefined
      },
    },
    { label: 'docspp' },
  )
}

function convert(s: OutlineSymbol): vscode.DocumentSymbol {
  const range = toRange(s.range)
  // The selection range must lie inside the range, or VS Code rejects the whole outline.
  const selection = range.contains(toRange(s.selection)) ? toRange(s.selection) : range
  const symbol = new vscode.DocumentSymbol(
    s.name || '(unnamed)',
    s.detail ?? '',
    KINDS[s.kind],
    range,
    selection,
  )
  symbol.children = s.children.map(convert)
  return symbol
}
