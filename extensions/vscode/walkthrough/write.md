## Write faster

```yaml
edges:
  - web -> api: HTTPS      # type "web -" and a node id, then "->" for the other end
nodes:
  api:
    kind: service          # kinds, statuses and icons are completed
    icon: postgre          # run "idocs: Insert Icon" to search
```

- **Completion** knows where you are: keys, node ids, kinds, statuses and icons.
- **Hover** a node for its connections, an icon to see it, a key to read what it means.
- **F2** renames a node everywhere: edges, steps, lanes, views and `nodes/<id>.md`.
- **F12** goes to where a node is declared; **Shift+F12** finds every use.
