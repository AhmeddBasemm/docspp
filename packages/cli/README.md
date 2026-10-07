# @docspp/cli

```sh
docspp check [root...] [--json] [--strict]   validate diagrams; errors say file:line:col and suggest fixes
docspp list [root] [--json]                  diagrams, views and scenarios
docspp schema [root]                         write diagrams/diagram.schema.json for editor autocomplete
docspp icons search <query>                  find an icon name
docspp new <name> [root]                     scaffold diagrams/<name>/
```

`check` also warns when a node's `refs:` point at files that no longer exist.
