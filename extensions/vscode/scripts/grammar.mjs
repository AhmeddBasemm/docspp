// Generates syntaxes/docspp.tmLanguage.json.
//
// The grammar is self-contained instead of including `source.yaml`: the built-in YAML grammar's
// internals change between VS Code releases, and rules injected into it cannot see the line a
// value sits on. Diagram files only use a small part of YAML, so we scan that part ourselves.
//
// Every line is scanned on its own (indentation never nests), apart from block scalars, flow
// collections and quoted strings, which are real regions. A key opens a region that ends at the end
// of the line, so the value after it can be scoped by what the key means. Block and flow context
// need different value rules (a comma is text in one and a separator in the other), which is why
// the rules are built here and not written out twice.
//
// Run `pnpm --filter docspp-vscode grammar` after changing this file; a test fails when the
// committed JSON is stale.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ID = '[A-Za-z0-9_.-]+'

/** Keys whose value names a node, group or view. */
const REF_KEYS = ['from', 'to', 'at', 'in', 'via', 'include', 'exclude', 'nodes', 'view']
const KIND_KEYS = ['kind']
const ENUM_KEYS = ['status', 'family', 'direction', 'layout', 'mode', 'type']
const ICON_KEYS = ['icon']
/** Keys whose block scalar is markdown. */
const MARKDOWN_KEYS = ['description', 'summary', 'note']

// A literal backtick, kept out of the raw templates below.
const BT = '`'

const alt = (names) => `(?:${names.join('|')})`
const keyName = (names) => `(${alt(names)})(?=[ \\t]*:(?:\\s|$))`

// A key written without quotes. The first character cannot start another construct.
const PLAIN_KEY = String.raw`[^\s#,\[\]{}&*!|>'"%@${BT}-][^#\n]*?|-(?=\S)[^#\n]*?`
const QUOTED_KEY = String.raw`"(?:[^"\\]|\\.)*"|'(?:[^']|'')*'`
const ANY_KEY = `(?:${QUOTED_KEY}|${PLAIN_KEY})`
const FLOW_KEY = String.raw`(?:${QUOTED_KEY}|[^\s#,\[\]{}&*!|>'"%@${BT}:][^#,\[\]{}:\n]*?)`

const LINE_PREFIX = String.raw`^(\s*)((?:-[ \t]+)*)`

const scope = (name) => `${name}.docspp`

/** What a value token may be followed by, per context. */
const tokenEnd = (flow) =>
  flow ? String.raw`(?=[ \t]*(?:$|#|,|\]|\}))` : String.raw`(?=[ \t]*(?:$|#))`

const punctuation = {
  colon: 'punctuation.separator.key-value.mapping.yaml',
  dash: 'punctuation.definition.block.sequence.item.yaml',
}

/** Semantic value rules: which keys, which scope their (single-token) value gets. */
const SEMANTIC = [
  { id: 'ref', keys: REF_KEYS, scope: scope('variable.other.reference'), lists: true },
  { id: 'kind', keys: KIND_KEYS, scope: scope('support.constant.kind') },
  { id: 'enum', keys: ENUM_KEYS, scope: scope('support.constant.enum') },
  { id: 'icon', keys: ICON_KEYS, scope: scope('support.constant.icon'), loose: true },
]

function semanticToken(def, flow) {
  const body = def.loose
    ? flow
      ? String.raw`[^\s#'",\[\]{}&*!|>%@${BT}][^#,\[\]{}]*?`
      : String.raw`[^\s#'",\[\]{}&*!|>%@${BT}][^#]*?`
    : ID
  const end = def.loose
    ? flow
      ? String.raw`(?=[ \t]*(?:$|#|,|\}))`
      : String.raw`(?=[ \t]+#|[ \t]*$)`
    : tokenEnd(flow)
  return { match: `${body}${end}`, name: def.scope }
}

/** A flow sequence of references: `via: [gateway, cache]`. */
function refList(name) {
  return {
    name: scope('meta.flow-sequence'),
    begin: String.raw`\[`,
    end: String.raw`\]`,
    beginCaptures: { 0: { name: 'punctuation.definition.sequence.begin.yaml' } },
    endCaptures: { 0: { name: 'punctuation.definition.sequence.end.yaml' } },
    patterns: [
      { include: '#comment' },
      { match: ',', name: 'punctuation.separator.sequence.yaml' },
      { include: '#string' },
      { match: `${ID}(?=[ \\t]*(?:,|\\]|$))`, name },
      { include: '#flow-value' },
    ],
  }
}

function build() {
  const repository = {}

  repository.comment = {
    match: String.raw`(?<![^\s])(#).*$`,
    name: 'comment.line.number-sign.yaml',
    captures: { 1: { name: 'punctuation.definition.comment.yaml' } },
  }

  repository.document = {
    patterns: [
      { match: '^---(?=\\s|$)', name: 'entity.other.document.begin.yaml' },
      { match: '^\\.\\.\\.(?=\\s|$)', name: 'entity.other.document.end.yaml' },
      { match: '^%.*$', name: 'meta.directive.yaml' },
    ],
  }

  repository.string = {
    patterns: [
      {
        name: 'string.quoted.double.yaml',
        begin: '"',
        end: '"',
        beginCaptures: { 0: { name: 'punctuation.definition.string.begin.yaml' } },
        endCaptures: { 0: { name: 'punctuation.definition.string.end.yaml' } },
        patterns: [
          {
            match: String.raw`\\(?:[0abt\tnvfre "/\\N_LP]|x\h{2}|u\h{4}|U\h{8})`,
            name: 'constant.character.escape.yaml',
          },
        ],
      },
      {
        name: 'string.quoted.single.yaml',
        begin: "'",
        end: "'(?!')",
        beginCaptures: { 0: { name: 'punctuation.definition.string.begin.yaml' } },
        endCaptures: { 0: { name: 'punctuation.definition.string.end.yaml' } },
        patterns: [{ match: "''", name: 'constant.character.escape.yaml' }],
      },
    ],
  }

  repository.properties = {
    patterns: [
      {
        match: String.raw`(&)([^\s,\[\]{}]+)`,
        name: 'meta.property.anchor.yaml',
        captures: {
          1: { name: 'punctuation.definition.anchor.yaml' },
          2: { name: 'entity.name.type.anchor.yaml' },
        },
      },
      {
        match: String.raw`(\*)([^\s,\[\]{}]+)`,
        captures: {
          1: { name: 'punctuation.definition.alias.yaml' },
          2: { name: 'variable.other.alias.yaml' },
        },
      },
      { match: String.raw`![^\s,\[\]{}]*`, name: 'storage.type.tag-handle.yaml' },
    ],
  }

  repository.constants = {
    patterns: [
      {
        match: String.raw`(?<![\w.-])(?:true|false)(?=[ \t]*(?:$|#|,|\]|\}))`,
        name: 'constant.language.boolean.yaml',
      },
      {
        match: String.raw`(?<![\w.-])(?:null|~)(?=[ \t]*(?:$|#|,|\]|\}))`,
        name: 'constant.language.null.yaml',
      },
      {
        match: String.raw`(?<![\w.-])[-+]?(?:\d[\d_]*(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?(?=[ \t]*(?:$|#|,|\]|\}))`,
        name: 'constant.numeric.yaml',
      },
    ],
  }

  const flowCollections = {
    patterns: [{ include: '#flow-sequence' }, { include: '#flow-mapping' }],
  }
  repository['flow-collections'] = flowCollections

  repository['flow-sequence'] = {
    name: scope('meta.flow-sequence'),
    begin: String.raw`\[`,
    end: String.raw`\]`,
    beginCaptures: { 0: { name: 'punctuation.definition.sequence.begin.yaml' } },
    endCaptures: { 0: { name: 'punctuation.definition.sequence.end.yaml' } },
    patterns: [
      { include: '#comment' },
      { match: ',', name: 'punctuation.separator.sequence.yaml' },
      { include: '#flow-value' },
    ],
  }

  // Inside `{ ... }` a key opens a region that ends at the next `,` or `}`.
  const flowKeyRules = [
    ...SEMANTIC.map((def) => flowKey(keyName(def.keys), def)),
    flowKey(`(${FLOW_KEY})(?=[ \\t]*:(?:[\\s,}\\]]|$))`),
  ]
  repository['flow-mapping'] = {
    name: scope('meta.flow-mapping'),
    begin: String.raw`\{`,
    end: String.raw`\}`,
    beginCaptures: { 0: { name: 'punctuation.definition.mapping.begin.yaml' } },
    endCaptures: { 0: { name: 'punctuation.definition.mapping.end.yaml' } },
    patterns: [
      { include: '#comment' },
      { match: ',', name: 'punctuation.separator.mapping.yaml' },
      ...flowKeyRules,
      { include: '#flow-value' },
    ],
  }

  repository['flow-value'] = {
    patterns: [
      { include: '#comment' },
      { include: '#properties' },
      { include: '#string' },
      { include: '#flow-collections' },
      { include: '#constants' },
      {
        match: String.raw`[^\s,\[\]{}#'"&*!|>%@${BT}][^,\[\]{}#]*?(?=[ \t]*(?:[,\]}]|[ \t]#|$))`,
        name: 'string.unquoted.plain.in.yaml',
      },
    ],
  }

  repository['block-value'] = {
    patterns: [
      { include: '#comment' },
      { include: '#properties' },
      { include: '#string' },
      { include: '#flow-collections' },
      { include: '#constants' },
      { match: String.raw`\S.*?(?=[ \t]+#|[ \t]*$)`, name: 'string.unquoted.plain.out.yaml' },
    ],
  }

  repository['block-scalars'] = { patterns: blockScalars() }
  repository['sequence-items'] = { patterns: [sequenceItem()] }
  repository.arrows = { patterns: arrowRules() }
  repository['mapping-keys'] = { patterns: blockKeys() }

  return {
    $schema: 'https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json',
    name: 'docspp',
    scopeName: 'source.docspp',
    patterns: [
      { include: '#document' },
      { include: '#comment' },
      { include: '#block-scalars' },
      { include: '#arrows' },
      { include: '#mapping-keys' },
      { include: '#sequence-items' },
      { include: '#block-value' },
    ],
    repository,
  }
}

function flowKey(match, def) {
  const values = def
    ? [
        ...(def.lists ? [refList(def.scope)] : []),
        { include: '#string' },
        semanticToken(def, true),
        { include: '#flow-value' },
      ]
    : [{ include: '#flow-value' }]
  return {
    begin: `${match}([ \\t]*)(:)`,
    beginCaptures: {
      1: { name: 'entity.name.tag.yaml' },
      3: { name: punctuation.colon },
    },
    end: String.raw`(?=[,}\]])`,
    name: scope('meta.mapping.pair'),
    patterns: values,
  }
}

/** `key: value` lines. Semantic keys come first so their values get the more specific scope. */
function blockKeys() {
  const keyCaptures = {
    2: { patterns: [{ match: '-', name: punctuation.dash }] },
    3: { name: 'entity.name.tag.yaml' },
    5: { name: punctuation.colon },
  }
  const rule = (key, patterns) => ({
    begin: `${LINE_PREFIX}${key}([ \\t]*)(:)(?=\\s|$)`,
    beginCaptures: keyCaptures,
    end: '$',
    name: scope('meta.mapping.pair'),
    patterns,
  })

  return [
    ...SEMANTIC.map((def) =>
      rule(keyName(def.keys), [
        { include: '#comment' },
        ...(def.lists ? [refList(def.scope)] : []),
        { include: '#string' },
        semanticToken(def, false),
        { include: '#block-value' },
      ]),
    ),
    rule(`(${ANY_KEY})(?=[ \\t]*:(?:\\s|$))`, [{ include: '#block-value' }]),
  ]
}

/** `- a -> b: label` and `- at node: label`. */
function arrowRules() {
  const ref = scope('variable.other.reference')
  const dashes = { 2: { patterns: [{ match: '-', name: punctuation.dash }] } }
  const tail = [
    { include: '#comment' },
    { match: '(:)(?=\\s|$)', name: punctuation.colon },
    { include: '#block-value' },
  ]
  const after = String.raw`(?=[ \t]*(?::(?:\s|$)|#|$))`
  return [
    {
      begin: `^(\\s*)((?:-[ \\t]+)+)(${ID})([ \\t]*)(<->|->)([ \\t]*)(${ID})${after}`,
      beginCaptures: {
        ...dashes,
        3: { name: ref },
        5: { name: scope('keyword.operator.arrow') },
        7: { name: ref },
      },
      end: '$',
      name: scope('meta.arrow'),
      patterns: tail,
    },
    {
      begin: `^(\\s*)((?:-[ \\t]+)+)(at)([ \\t]+)(${ID})${after}`,
      beginCaptures: {
        ...dashes,
        3: { name: 'entity.name.tag.yaml' },
        5: { name: ref },
      },
      end: '$',
      name: scope('meta.arrow'),
      patterns: tail,
    },
  ]
}

/** A `-` with a plain value, or a bare `-`. Anything after it is scanned as a value. */
function sequenceItem() {
  return {
    match: String.raw`^(\s*)((?:-(?:[ \t]+|$))+)`,
    captures: { 2: { patterns: [{ match: '-', name: punctuation.dash }] } },
  }
}

/**
 * Block scalars (`|` and `>`). A scalar ends at the first non-blank line that is not indented
 * deeper than the line that opened it, so the end pattern refers back to that line's indentation.
 * For `- key: |` the key sits after the dash, so the content must be indented past it as well.
 */
function blockScalars() {
  const HEADER = '([|>](?:[1-9][-+]?|[-+][1-9]?)?)'
  const COMMENT = String.raw`[ \t]*(#.*)?$`
  const indicator = { name: 'keyword.control.flow.block-scalar.yaml' }
  const rules = []

  const make = (begin, end, captures, markdown) => ({
    begin,
    end,
    beginCaptures: captures,
    ...(markdown
      ? {
          contentName: 'meta.embedded.block.markdown',
          patterns: [{ include: 'text.html.markdown' }],
        }
      : { contentName: 'string.unquoted.block.yaml' }),
    name: scope('meta.block-scalar'),
  })

  for (const markdown of [true, false]) {
    const key = markdown ? keyName(MARKDOWN_KEYS) : `(${ANY_KEY})(?=[ \\t]*:(?:\\s|$))`
    // `key: |`
    rules.push(
      make(
        `^(\\s*)${key}([ \\t]*)(:)[ \\t]+${HEADER}${COMMENT}`,
        String.raw`^(?!\s*$)(?!\1\s)`,
        {
          2: { name: 'entity.name.tag.yaml' },
          4: { name: punctuation.colon },
          5: indicator,
          6: { name: 'comment.line.number-sign.yaml' },
        },
        markdown,
      ),
    )
    // `- key: |`
    rules.push(
      make(
        `^(\\s*)-([ \\t]+)${key}([ \\t]*)(:)[ \\t]+${HEADER}${COMMENT}`,
        String.raw`^(?!\s*$)(?!\1 \2\s)`,
        {
          3: { name: 'entity.name.tag.yaml' },
          5: { name: punctuation.colon },
          6: indicator,
          7: { name: 'comment.line.number-sign.yaml' },
        },
        markdown,
      ),
    )
  }
  // `- |`
  rules.push(
    make(
      `^(\\s*)-[ \\t]+${HEADER}${COMMENT}`,
      String.raw`^(?!\s*$)(?!\1\s)`,
      { 2: indicator, 3: { name: 'comment.line.number-sign.yaml' } },
      false,
    ),
  )
  return rules
}

export function buildGrammar() {
  return build()
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = fileURLToPath(new URL('../syntaxes/docspp.tmLanguage.json', import.meta.url))
  writeFileSync(out, `${JSON.stringify(build(), null, 2)}\n`)
  console.log(`wrote ${out}`)
}
