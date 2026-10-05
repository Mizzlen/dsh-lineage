// Markdown renderer for expanded map cards. The native conversation's
// renderer is internal to dsh-client-ui-chat and not exported, so this
// reproduces its spec for the constructs DeepSeek replies actually contain:
// fenced code, headings, ordered/unordered lists (one nesting level), tables,
// blockquotes, hr, and inline code/bold/italic/strike/links.
// Output is React elements — no HTML injection anywhere.
import { createElement, Fragment, type ReactNode } from 'react'

let keyCounter = 0
const nextKey = () => `md${keyCounter += 1}`

// ---------- inline ----------

const INLINE_RULES: Array<{ pattern: RegExp; render: (match: RegExpExecArray) => ReactNode }> = [
  { pattern: /`([^`]+)`/, render: m => createElement('code', { key: nextKey(), className: 'dshm-mcode' }, m[1]) },
  { pattern: /\*\*([^*]+)\*\*/, render: m => createElement('strong', { key: nextKey() }, m[1]) },
  { pattern: /__([^_]+)__/, render: m => createElement('strong', { key: nextKey() }, m[1]) },
  { pattern: /(^|[^*])\*([^*\n]+)\*/, render: m => createElement(Fragment, { key: nextKey() }, m[1], createElement('em', { key: nextKey() + 'e' }, m[2])) },
  { pattern: /~~([^~]+)~~/, render: m => createElement('del', { key: nextKey() }, m[1]) },
  { pattern: /\[([^\]]+)\]\(([^)\s]+)\)/, render: m => createElement('a', { key: nextKey(), href: m[2], target: '_blank', rel: 'noreferrer noopener' }, m[1]) },
]

/** Render one line's inline markdown into React nodes. */
export function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let rest = text
  while (rest.length > 0) {
    let best: { index: number; match: RegExpExecArray; render: (m: RegExpExecArray) => ReactNode } | null = null
    for (const rule of INLINE_RULES) {
      const match = rule.pattern.exec(rest)
      if (match !== null && (best === null || match.index < best.index)) {
        best = { index: match.index, match, render: rule.render }
      }
    }
    if (best === null) {
      nodes.push(rest)
      break
    }
    if (best.index > 0) nodes.push(rest.slice(0, best.index))
    nodes.push(best.render(best.match))
    rest = rest.slice(best.index + best.match[0].length)
  }
  return nodes
}

// ---------- blocks ----------

function splitRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim())
}

const isTableDelimiter = (line: string): boolean =>
  /^\s*\|?[\s:-]*-[-\s:|]*\|?\s*$/.test(line) && line.includes('-')

function renderTable(lines: string[], index: number): ReactNode {
  const header = splitRow(lines[index])
  const body = lines.slice(index + 2).map(splitRow)
  return createElement('table', { key: nextKey(), className: 'dshm-table' },
    createElement('thead', { key: 'h' },
      createElement('tr', { key: 'r' }, header.map((cell, i) => createElement('th', { key: i }, renderInline(cell))))),
    createElement('tbody', { key: 'b' },
      body.map((row, r) => createElement('tr', { key: r }, row.map((cell, c) => createElement('td', { key: c }, renderInline(cell)))))),
  )
}

function renderList(lines: string[], start: number): { node: ReactNode; next: number } {
  const ordered = /^\s*\d+[.)]\s/.test(lines[start])
  const items: Array<{ indent: number; lines: string[] }> = []
  let i = start
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') break
    const isItem = ordered ? /^\s*\d+[.)]\s/.test(line) : /^\s*[-*+]\s/.test(line)
    if (!isItem && items.length > 0 && /^\s+\S/.test(line)) {
      items[items.length - 1].lines.push(line.trim())
      i += 1
      continue
    }
    if (!isItem) break
    const indent = line.length - line.trimStart().length
    items.push({ indent, lines: [line.replace(ordered ? /^\s*\d+[.)]\s/ : /^\s*[-*+]\s/, '').trim()] })
    i += 1
  }
  const topLevel = items[0]?.indent ?? 0
  const children: ReactNode[] = []
  for (const item of items) {
    const nested = item.indent >= topLevel + 2
    const target = nested && children.length > 0
      ? (children[children.length - 1] as { props: { children: ReactNode[] } })
      : null
    const content = renderInline(item.lines.join(' '))
    if (target !== null && Array.isArray(target.props.children)) {
      target.props.children.push(createElement('li', { key: nextKey() }, content))
    } else {
      children.push(createElement('li', { key: nextKey() }, content))
    }
  }
  return { node: createElement(ordered ? 'ol' : 'ul', { key: nextKey(), className: 'dshm-list' }, children), next: i }
}

/** Render markdown text into React block elements. */
export function renderMarkdown(text: string): ReactNode[] {
  keyCounter = 0
  const lines = text.replaceAll('\r\n', '\n').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const fence = /^```(\w*)/.exec(line)
    if (fence !== null) {
      const lang = fence[1] || null
      const code: string[] = []
      i += 1
      while (i < lines.length && !/^```/.test(lines[i])) {
        code.push(lines[i])
        i += 1
      }
      i += 1
      blocks.push(createElement('pre', { key: nextKey(), className: 'dshm-pre', 'data-lang': lang ?? undefined },
        createElement('code', { key: 'c' }, code.join('\n'))))
      continue
    }
    if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
      blocks.push(createElement('hr', { key: nextKey(), className: 'dshm-hr' }))
      i += 1
      continue
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading !== null) {
      const level = heading[1].length
      blocks.push(createElement(`h${level}`, { key: nextKey(), className: `dshm-h dshm-h${level}` }, renderInline(heading[2])))
      i += 1
      continue
    }
    if (line.startsWith('>')) {
      const quote: string[] = []
      while (i < lines.length && lines[i].startsWith('>')) {
        quote.push(lines[i].replace(/^>\s?/, ''))
        i += 1
      }
      blocks.push(createElement('blockquote', { key: nextKey(), className: 'dshm-quote' }, renderMarkdown(quote.join('\n'))))
      continue
    }
    if (line.includes('|') && i + 1 < lines.length && isTableDelimiter(lines[i + 1]) && splitRow(line).length >= 2) {
      const table: string[] = []
      while (i < lines.length && lines[i].includes('|')) {
        table.push(lines[i])
        i += 1
      }
      blocks.push(renderTable(table, 0))
      continue
    }
    if (/^\s*[-*+]\s/.test(line) || /^\s*\d+[.)]\s/.test(line)) {
      const list = renderList(lines, i)
      blocks.push(list.node)
      i = list.next
      continue
    }
    if (line.trim() === '') {
      i += 1
      continue
    }
    const para: string[] = []
    const isTableStart = (index: number): boolean =>
      lines[index].includes('|') && index + 1 < lines.length && isTableDelimiter(lines[index + 1]) && splitRow(lines[index]).length >= 2
    while (
      i < lines.length && lines[i].trim() !== ''
      && !/^```/.test(lines[i])
      && !/^(#{1,6})\s/.test(lines[i])
      && !/^\s*[-*+]\s/.test(lines[i])
      && !/^\s*\d+[.)]\s/.test(lines[i])
      && !lines[i].startsWith('>')
      && !isTableStart(i)
      && !/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(lines[i])
    ) {
      para.push(lines[i])
      i += 1
    }
    blocks.push(createElement('p', { key: nextKey(), className: 'dshm-p' }, renderInline(para.join('\n'))))
  }
  return blocks
}
