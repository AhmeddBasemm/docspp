# docspp for VS Code

Write [docspp](https://github.com/AhmeddBasemm/docspp) architecture diagrams with highlighting, completion and a live preview, without leaving the editor.

![A diagram open in the preview](https://raw.githubusercontent.com/AhmeddBasemm/docspp/main/extensions/vscode/images/preview.png)

docspp diagrams are YAML files, `diagrams/<name>/diagram.yaml`, laid out automatically and playable: pick a scenario and a request travels through the system. This extension makes writing them as quick as reading them.

## Live preview

Open a diagram and press <kbd>Ctrl</kbd>+<kbd>K</kbd> <kbd>V</kbd> (<kbd>⌘</kbd>+<kbd>K</kbd> <kbd>V</kbd> on a Mac), or click the preview button in the editor title bar.

- **It updates as you type**, from the text in the editor, saved or not. Set `docspp.preview.refreshOn` to `save` if you would rather it waited.
- **It keeps the last good diagram** while the text has an error, and lists the problems above it. Click one to jump to it.
- **It follows the cursor.** The node you are editing is outlined in the diagram; click a node in the diagram to jump to where it is written.
- **It follows you** to other diagrams as you switch files. Lock it with the padlock to keep it where it is.
- **It is the real renderer**: pan and zoom, node details, views, and playing scenarios as packets, a sequence diagram or a swimlane story. (Full screen is left out; VS Code does not allow it inside a webview.)
- It takes your editor's colours and fonts, light or dark.

## Writing

- **Highlighting** for diagram and scenario files, with the `a -> b: label` shorthand, node references, kinds, statuses and icons scoped separately, and markdown inside `description`, `summary` and `note` blocks. ` ```docspp ` fences in Markdown are highlighted too.
- **Problems** are the same checks as `docspp check`, shown as you type: unknown keys with a suggestion, edges to nodes that do not exist, steps with no route, icons that do not resolve, and `refs:` that point at files that have moved.
- **Completion** for keys (with their documentation), node, group and view ids, kinds, statuses, scenario step shorthand and icon names. Run **docspp: Insert Icon** to search the icon catalog.
- **Hover** over a node for its title, kind and connections, over an icon to see it, over a key for what it means.
- **Go to definition**, **find all references** and **rename** for node, group and view ids, across `diagram.yaml` and every scenario file. Renaming a node also renames its `nodes/<id>.md`.
- **Outline** and breadcrumbs for nodes, edges, views and scenario steps.
- **Snippets** for a diagram, node, group, edge, view, scenario, phase, step, parallel steps and lane.
- **Status bar** entry for the diagram you are editing: a tick, or how many errors and warnings it has. Click it to see them.
- **Get started** walkthrough under Help → Welcome.

## Commands

| Command | |
|---|---|
| docspp: Open Preview / Open Preview to the Side | Preview the diagram you are editing |
| docspp: Keep Preview on This Diagram | Stop the preview following you to other diagrams |
| docspp: New Diagram | Create `diagrams/<name>/` with a working diagram, the same as `docspp new` |
| docspp: Insert Icon | Search the icon catalog and insert a name |
| docspp: Check All Diagrams | Compile every diagram in the workspace |

## Settings

| Setting | Default | |
|---|---|---|
| `docspp.diagnostics.enable` | `true` | Show errors and warnings in the Problems panel |
| `docspp.updateDelay` | `250` | Milliseconds after typing before checking and updating the preview |
| `docspp.preview.refreshOn` | `type` | `type` or `save` |
| `docspp.preview.followCursor` | `true` | Outline the node under the cursor in the preview |

## Which files

Files named `diagram.yaml` or `diagram.yml` in `diagrams/<name>/`, and `diagrams/<name>/scenarios/*.yaml`, open in the docspp language. A diagram kept elsewhere can be associated with the language through `files.associations`; the folder still has to contain a `diagram.yaml`.

The extension needs the files on disk, so it does not run in virtual workspaces.

## Versions

The extension carries the docspp compiler of its own release. If your project uses a newer docspp than the extension, a key added since may be reported as unknown until the extension is updated. `docspp check` always uses the version your project has installed.

## Links

[Documentation](https://ahmeddbasemm.github.io/docspp/) · [Issues](https://github.com/AhmeddBasemm/docspp/issues) · [Contributing](https://github.com/AhmeddBasemm/docspp/blob/main/extensions/vscode/DEVELOPMENT.md)
