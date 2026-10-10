// Go to definition, find references, rename and highlights for node, group and view ids.
import { join } from 'node:path'
import * as vscode from 'vscode'
import type { Declaration } from '../model/declarations'
import { declarationOf, isUseOf, type SymbolRef, symbolAt } from '../model/references'
import type { DiagramService, FileModel } from './service'
import { toRange } from './symbols'

const SELECTOR = { language: 'idocs', scheme: 'file' }
const ID = /^[A-Za-z0-9_.-]+$/

interface Found {
  folder: string
  model: FileModel
  symbol: SymbolRef
  /** The diagram.yaml model, which holds the declarations. */
  main: FileModel
}

export function registerNavigation(service: DiagramService): vscode.Disposable[] {
  const find = (document: vscode.TextDocument, position: vscode.Position): Found | undefined => {
    const where = service.locate(document.uri)
    if (!where || (where.role !== 'diagram' && where.role !== 'scenario')) return undefined
    const model = service.model(document.uri.fsPath, where)
    const mainPath = service.mainFile(where.folder)
    const main = mainPath ? service.model(mainPath) : undefined
    if (!model || !main) return undefined
    // Declarations are positions in diagram.yaml; in a scenario file only uses can be under the cursor.
    const symbol = symbolAt(
      { line: position.line, character: position.character },
      model.refs,
      model.role === 'diagram' ? model.declarations : [],
    )
    if (!symbol) return undefined
    return { folder: where.folder, model, symbol, main }
  }

  return [
    vscode.languages.registerDefinitionProvider(SELECTOR, {
      provideDefinition(document, position) {
        const hit = find(document, position)
        const declared = hit && declarationOf(hit.symbol, hit.main.declarations)
        return hit && declared
          ? new vscode.Location(uriOf(hit.main), toRange(declared.key))
          : undefined
      },
    }),

    vscode.languages.registerReferenceProvider(SELECTOR, {
      provideReferences(document, position, context) {
        const hit = find(document, position)
        if (!hit) return undefined
        const out: vscode.Location[] = []
        const declared = declarationOf(hit.symbol, hit.main.declarations)
        if (context.includeDeclaration && declared) {
          out.push(new vscode.Location(uriOf(hit.main), toRange(declared.key)))
        }
        for (const m of service.models(hit.folder)) {
          for (const r of m.refs) {
            if (isUseOf(r, hit.symbol)) out.push(new vscode.Location(uriOf(m), toRange(r.span)))
          }
        }
        return out
      },
    }),

    vscode.languages.registerDocumentHighlightProvider(SELECTOR, {
      provideDocumentHighlights(document, position) {
        const hit = find(document, position)
        if (!hit) return undefined
        const out: vscode.DocumentHighlight[] = []
        const declared = declarationOf(hit.symbol, hit.model.declarations)
        if (declared) {
          out.push(
            new vscode.DocumentHighlight(toRange(declared.key), vscode.DocumentHighlightKind.Write),
          )
        }
        for (const r of hit.model.refs) {
          if (isUseOf(r, hit.symbol)) {
            out.push(
              new vscode.DocumentHighlight(toRange(r.span), vscode.DocumentHighlightKind.Read),
            )
          }
        }
        return out
      },
    }),

    vscode.languages.registerRenameProvider(SELECTOR, {
      prepareRename(document, position) {
        const hit = find(document, position)
        if (!hit) throw new Error('Only node, group and view ids can be renamed.')
        if (!declarationOf(hit.symbol, hit.main.declarations)) {
          throw new Error(`"${hit.symbol.id}" is not declared in this diagram.`)
        }
        return { range: toRange(hit.symbol.span), placeholder: hit.symbol.id }
      },

      provideRenameEdits(document, position, newName) {
        const hit = find(document, position)
        if (!hit) return undefined
        const declared = declarationOf(hit.symbol, hit.main.declarations)
        if (!declared) throw new Error(`"${hit.symbol.id}" is not declared in this diagram.`)
        if (!ID.test(newName)) {
          throw new Error('Ids may only contain letters, digits, "_", "." and "-".')
        }
        if (
          newName !== hit.symbol.id &&
          declarationOf({ ...hit.symbol, id: newName }, hit.main.declarations)
        ) {
          throw new Error(`"${newName}" is already used in this diagram.`)
        }

        const edit = new vscode.WorkspaceEdit()
        edit.replace(uriOf(hit.main), toRange(declared.key), newName)
        for (const m of service.models(hit.folder)) {
          for (const r of m.refs) {
            if (isUseOf(r, hit.symbol)) edit.replace(uriOf(m), toRange(r.span), newName)
          }
        }
        if (hit.symbol.namespace === 'member' && declared.section === 'nodes') {
          renameDoc(edit, service, hit, declared, newName)
        }
        return edit
      },
    }),
  ]
}

/**
 * A node's documentation is `nodes/<id>.md`, found by name or named in `doc:`. Move the file with
 * the id, and keep `doc:` pointing at it.
 */
function renameDoc(
  edit: vscode.WorkspaceEdit,
  service: DiagramService,
  hit: Found,
  declared: Declaration,
  newName: string,
): void {
  const explicit = declared.props.doc
  const named = (id: string) => `nodes/${id}.md`
  // Only the file this node's docs are in: an explicit `doc:` elsewhere is not ours to move.
  if (explicit !== undefined && explicit.replace(/^\.\//, '') !== named(hit.symbol.id)) return

  const from = vscode.Uri.file(join(hit.folder, named(hit.symbol.id)))
  const to = vscode.Uri.file(join(hit.folder, named(newName)))
  const fs = service.fs
  if (fs.exists(from.fsPath) && !fs.exists(to.fsPath)) edit.renameFile(from, to)
  if (explicit !== undefined && declared.docSpan) {
    const dotted = explicit.startsWith('./') ? './' : ''
    edit.replace(uriOf(hit.main), toRange(declared.docSpan), `${dotted}${named(newName)}`)
  }
}

const uriOf = (model: FileModel) => vscode.Uri.file(model.path)
