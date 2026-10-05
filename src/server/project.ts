// Pure projection: raw session log → turn cards.
// Shapes verified against @deepseek-ai/dsh-session 0.2.0-rc.2 types
// (SessionEvent envelope, UserMessage.source.kind, ToolResultMessage) and
// docs/contract-notes.md §d. Everything here is defensive by design: unknown
// event types are ignored, never crash, never guessed.
import type { TurnDTO } from '../shared/protocol'

/** One raw event as delivered by sessionQuery.readSession (subset we rely on). */
export interface RawEvent {
  type: string
  seq: number
  time: number
  data?: any
  ignorable?: true
  surfaceOp?: unknown
}

/** The session-log observation as delivered by sessionQuery.readSession. */
export interface RawSessionLog {
  session: { id?: string }
  inheritedEventCount?: number
  events: RawEvent[]
}

const ANSWER_SNIPPET_LIMIT = 400
const QUESTION_SNIPPET_LIMIT = 800
const FULL_LIMIT = 200_000

function snippetIn(full: boolean, text: string, limit: number): string {
  return snippet(text, full ? FULL_LIMIT : limit)
}

/** Extract model-facing text from a message content block list. */
export function contentText(content: unknown): string {
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  for (const block of content) {
    if (block === null || typeof block !== 'object') continue
    const b = block as Record<string, unknown>
    if (b.type === 'text' && typeof b.text === 'string') parts.push(b.text)
    if (b.type === 'tool-call') {
      const name = typeof b.name === 'string' ? b.name : 'tool'
      parts.push(`[${name}]`)
    }
    if (b.type === 'tool-result') parts.push(contentText(b.content))
  }
  return parts.filter(p => p.trim() !== '').join('\n')
}

/** Extract plain text blocks only (assistant answers: never fold reasoning
 * or tool-call blocks into the visible reply). */
export function textContent(content: unknown): string {
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  for (const block of content) {
    if (block === null || typeof block !== 'object') continue
    const b = block as Record<string, unknown>
    if (b.type === 'text' && typeof b.text === 'string') parts.push(b.text)
  }
  return parts.filter(p => p.trim() !== '').join('\n')
}

function snippet(text: string, limit: number): string {
  const normalized = text.replace(/\s+\n/g, '\n').trim()
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, limit)}…`
}

function describeError(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (value === null || value === undefined || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  const name = typeof v.name === 'string' ? v.name : ''
  const message = typeof v.message === 'string' ? v.message : ''
  return [name, message].filter(Boolean).join(': ') || null
}

interface MutableTurn {
  startSeq: number
  messageId: string | null
  time: number
  question: string
  answerParts: string[]
  tools: Array<{ name: string; ok: boolean }>
  pendingCalls: Map<string, number>
  todoCount: number
  status: 'ok' | 'error' | 'cancelled'
  approvals: Array<{ toolName: string | null; pending: boolean }>
  pendingApprovalIds: Map<string, number>
}

/**
 * Fold one session's raw log into turn cards.
 * - Only `source.kind === 'user'` opens a turn: plugin/webhook/schedule
 *   injections (system-reminder et al.) never become cards — the regression
 *   behind synapse #23/#31 by construction.
 * - Fork-inherited prefix (`inheritedEventCount`) is skipped: the parent card
 *   already represents that history.
 * - `full` skips card snippets for the expanded reading view.
 */
export function buildTurns(log: RawSessionLog, full = false): TurnDTO[] {
  const inherited = Number.isSafeInteger(log.inheritedEventCount) ? (log.inheritedEventCount as number) : 0
  const turns: MutableTurn[] = []
  let current: MutableTurn | null = null

  for (const event of log.events ?? []) {
    if (!event || typeof event.type !== 'string') continue
    if (Number.isSafeInteger(event.seq) && event.seq < inherited) continue
    const data = (event.data ?? {}) as Record<string, any>

    if (event.type === 'user/message') {
      const kind = data?.source?.kind
      if (kind !== 'user') continue
      const text = contentText(data?.content)
      if (text.trim() === '') continue
      current = {
        startSeq: event.seq,
        messageId: typeof data?.id === 'string' ? data.id : null,
        time: typeof event.time === 'number' ? event.time : 0,
        question: snippetIn(full, text, QUESTION_SNIPPET_LIMIT),
        answerParts: [],
        tools: [],
        pendingCalls: new Map(),
        todoCount: 0,
        status: 'ok',
        approvals: [],
        pendingApprovalIds: new Map(),
      }
      turns.push(current)
      continue
    }
    if (current === null) continue

    switch (event.type) {
      case 'assistant/message': {
        // Real shape (0.2.0-rc.2 log): { turn, step, message: { content }, usage, stream }
        const text = textContent(data?.message?.content)
        if (text.trim() !== '') current.answerParts.push(text)
        break
      }
      case 'tool/call': {
        const callId = typeof data?.callId === 'string' || typeof data?.callId === 'number' ? String(data.callId) : null
        const name = typeof data?.name === 'string' ? data.name : 'tool'
        if (callId !== null) {
          // Replace any prior entry for the same callId (re-invocations).
          const idx = current.pendingCalls.get(callId)
          if (idx !== undefined) {
            current.tools[idx] = { name, ok: true }
            current.pendingCalls.set(callId, idx)
          } else {
            current.pendingCalls.set(callId, current.tools.length)
            current.tools.push({ name, ok: true })
          }
        } else {
          current.tools.push({ name, ok: true })
        }
        break
      }
      case 'tool/result': {
        // Real shape: { turn, step, message: { source: { kind: 'tool', callId }, isError? }, meta }
        const callId = data?.message?.source?.callId ?? data?.source?.callId
        const key = typeof callId === 'string' || typeof callId === 'number' ? String(callId) : null
        const ok = data?.message?.isError !== true && data?.isError !== true
        const idx = key !== null ? current.pendingCalls.get(key) : undefined
        if (idx !== undefined && idx < current.tools.length) current.tools[idx] = { ...current.tools[idx], ok }
        else if (key !== null) current.pendingCalls.set(key, current.tools.push({ name: 'tool', ok }) - 1)
        break
      }
      case 'todo/write': {
        if (Array.isArray(data?.todos)) current.todoCount = data.todos.length
        break
      }
      case 'turn/end': {
        const reason = data?.reason
        const kind = reason?.kind
        if (kind === 'error') {
          current.status = 'error'
          const detail = describeError(reason?.error)
          if (detail !== null) current.answerParts.push(`Error: ${detail}`)
        } else if (kind === 'cancelled' || kind === 'canceled' || kind === 'aborted') {
          current.status = 'cancelled'
        }
        break
      }
      case 'approval/asked': {
        // Real shape: { id, callId?, reason?, toolName? }
        const id = typeof data?.id === 'string' ? data.id : null
        const toolName = typeof data?.toolName === 'string' ? data.toolName : null
        const index = current.approvals.push({ toolName, pending: true }) - 1
        if (id !== null) current.pendingApprovalIds.set(id, index)
        break
      }
      case 'approval/decided': {
        const id = typeof data?.id === 'string' ? data.id : null
        const index = id !== null ? current.pendingApprovalIds.get(id) : undefined
        if (index !== undefined && index < current.approvals.length) {
          current.approvals[index] = { ...current.approvals[index], pending: false }
        }
        break
      }
      default:
        break
    }
  }

  return turns.map(turn => ({
    startSeq: turn.startSeq,
    messageId: turn.messageId,
    time: turn.time,
    question: turn.question,
    answer: snippetIn(full, turn.answerParts.join('\n\n'), ANSWER_SNIPPET_LIMIT),
    tools: turn.tools,
    todoCount: turn.todoCount,
    status: turn.status,
    approvals: turn.approvals,
  }))
}

/** Fallback card title when no generated title exists: the first question. */
export function titleFromTurns(turns: TurnDTO[]): string | null {
  const first = turns[0]?.question ?? ''
  const line = first.replaceAll(/\s+/g, ' ').trim()
  if (line === '') return null
  return line.length > 42 ? `${line.slice(0, 42)}…` : line
}
