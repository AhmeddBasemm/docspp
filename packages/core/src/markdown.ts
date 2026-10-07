import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  // Raw HTML in markdown is dropped on purpose: compiled docs are injected into the page.
  .use(remarkRehype)
  .use(rehypeStringify)

export function renderMarkdown(md: string): string {
  const body = stripFrontmatter(md).trim()
  if (!body) return ''
  return String(processor.processSync(body))
}

export function stripFrontmatter(md: string): string {
  const m = md.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/)
  return m ? md.slice(m[0].length) : md
}
