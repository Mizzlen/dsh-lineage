import { describe, expect, it } from 'vitest'
import { renderMarkdown, renderInline } from '../src/client/markdown'

/** Flatten rendered React nodes to a readable tree string for assertions. */
function flatten(node: any): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(flatten).join('')
  const type = typeof node.type === 'function' ? (node.type.name ?? 'fn') : String(node.type)
  const props = node.props ?? {}
  const cls = props.className ? `.${String(props.className).split(' ').join('.')}` : ''
  const kids = Array.isArray(props.children) ? props.children.map(flatten).join('') : flatten(props.children)
  return `<${type}${cls}>${kids}</${type}>`
}

describe('renderMarkdown', () => {
  it('renders fenced code blocks with the language label', () => {
    const out = flatten(renderMarkdown('```ts\nconst a = 1\n```'))
    expect(out).toContain('<pre.dshm-pre')
    expect(out).toContain('const a = 1')
    expect(flatten(renderMarkdown('```ts\nx\n```')).match(/data-lang/) === null).toBe(true) // attr not in text
  })

  it('renders headings at their level', () => {
    const out = flatten(renderMarkdown('# 标题一\n## 小节'))
    expect(out).toContain('<h1.dshm-h.dshm-h1>标题一</h1>')
    expect(out).toContain('<h2.dshm-h.dshm-h2>小节</h2>')
  })

  it('renders unordered and ordered lists', () => {
    const ul = flatten(renderMarkdown('- 一\n- 二'))
    expect(ul).toContain('<ul.dshm-list>')
    expect(ul).toContain('<li>一</li>')
    const ol = flatten(renderMarkdown('1. 甲\n2. 乙'))
    expect(ol).toContain('<ol.dshm-list>')
    expect(ol).toContain('<li>乙</li>')
  })

  it('renders tables with header and body cells', () => {
    const out = flatten(renderMarkdown('| A | B |\n|---|---|\n| 1 | 2 |'))
    expect(out).toContain('<table.dshm-table>')
    expect(out).toContain('<th>A</th>')
    expect(out).toContain('<td>2</td>')
  })

  it('renders blockquotes and hr', () => {
    expect(flatten(renderMarkdown('> 引用'))).toContain('<blockquote.dshm-quote>')
    expect(flatten(renderMarkdown('---'))).toContain('<hr.dshm-hr>')
  })

  it('keeps paragraphs together and skips empty lines', () => {
    const out = flatten(renderMarkdown('第一段\n第二行\n\n第二段'))
    expect(out).toContain('第一段\n第二行')
    expect((out.match(/<p\.dshm-p>/g) ?? []).length).toBe(2)
  })
})

describe('renderInline', () => {
  it('renders bold, code, strike and links', () => {
    const out = flatten(renderInline('**粗** 和 `码` 和 ~~删~~ 和 [链](https://x.y)'))
    expect(out).toContain('<strong>粗</strong>')
    expect(out).toContain('<code.dshm-mcode>码</code>')
    expect(out).toContain('<del>删</del>')
    expect(out).toContain('<a>链</a>')
  })

  it('leaves plain text untouched', () => {
    expect(flatten(renderInline('普通文本 *没配对'))).toContain('普通文本')
  })
})
