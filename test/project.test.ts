import { describe, expect, it } from 'vitest'
import { buildTurns, contentText, textContent, titleFromTurns, type RawEvent } from '../src/server/project'

const userMessage = (seq: number, text: string, time = 1000): RawEvent => ({
  type: 'user/message',
  seq,
  time,
  data: { id: `m${seq}`, role: 'user', content: [{ type: 'text', text }], source: { kind: 'user' } },
})

const pluginInjection = (seq: number, text: string): RawEvent => ({
  type: 'user/message',
  seq,
  time: 1000,
  data: { id: `p${seq}`, role: 'user', content: [{ type: 'text', text }], source: { kind: 'plugin' } },
})

const assistantMessage = (seq: number, text: string): RawEvent => ({
  type: 'assistant/message',
  seq,
  time: 1000,
  surfaceOp: 'append',
  // Real 0.2.0-rc.2 shape: message is nested, blocks include reasoning + text.
  data: { turn: 1, step: 1, message: { id: `a${seq}`, role: 'assistant', content: [{ type: 'reasoning', text: 'thinking…' }, { type: 'text', text }], source: { kind: 'model' } }, usage: {} },
})

const toolCall = (seq: number, callId: string, name: string): RawEvent => ({
  type: 'tool/call',
  seq,
  time: 1000,
  data: { turn: 1, step: 1, callId, name, arguments: '{}' },
})

const toolResult = (seq: number, callId: string, isError = false): RawEvent => ({
  type: 'tool/result',
  seq,
  time: 1000,
  surfaceOp: 'append',
  data: { turn: 1, step: 1, message: { id: `t${seq}`, role: 'tool', content: [{ type: 'text', text: 'result' }], isError, source: { kind: 'tool', callId } }, meta: {} },
})

describe('buildTurns', () => {
  it('folds one question-answer turn with tool chips', () => {
    const turns = buildTurns({
      session: { id: 's1' },
      inheritedEventCount: 0,
      events: [
        userMessage(0, '帮我看看目录'),
        toolCall(1, 'c1', 'bash'),
        toolResult(2, 'c1'),
        assistantMessage(3, '目录内容如下'),
        turnEnd(4),
      ],
    })
    expect(turns).toHaveLength(1)
    expect(turns[0]).toMatchObject({
      startSeq: 0,
      question: '帮我看看目录',
      answer: '目录内容如下',
      status: 'ok',
    })
    expect(turns[0].tools).toEqual([{ name: 'bash', ok: true }])
  })

  it('never projects plugin injections as user cards (synapse #31 regression)', () => {
    const turns = buildTurns({
      session: { id: 's1' },
      inheritedEventCount: 0,
      events: [
        pluginInjection(0, '<system-reminder> AGENTS.md instructions…'),
        userMessage(1, '真正的问题'),
        assistantMessage(2, '回答'),
      ],
    })
    expect(turns).toHaveLength(1)
    expect(turns[0].question).toBe('真正的问题')
  })

  it('skips the fork-inherited prefix', () => {
    const turns = buildTurns({
      session: { id: 's2' },
      inheritedEventCount: 3,
      events: [
        userMessage(0, '父会话的问题'),
        assistantMessage(1, '父会话的回答'),
        turnEnd(2),
        userMessage(3, '子会话自己的问题'),
        assistantMessage(4, '子会话的回答'),
      ],
    })
    expect(turns).toHaveLength(1)
    expect(turns[0].question).toBe('子会话自己的问题')
    expect(turns[0].startSeq).toBe(3)
  })

  it('pairs multiple tool calls by callId, including failures (synapse #9 regression)', () => {
    const turns = buildTurns({
      session: { id: 's1' },
      inheritedEventCount: 0,
      events: [
        userMessage(0, '多工具轮'),
        toolCall(1, 'c1', 'read'),
        toolCall(2, 'c2', 'bash'),
        toolResult(3, 'c1'),
        toolResult(4, 'c2', true),
        assistantMessage(5, '完成'),
      ],
    })
    expect(turns[0].tools).toEqual([
      { name: 'read', ok: true },
      { name: 'bash', ok: false },
    ])
  })

  it('marks cancelled turns', () => {
    const turns = buildTurns({
      session: { id: 's1' },
      inheritedEventCount: 0,
      events: [userMessage(0, '打断我'), { type: 'turn/end', seq: 1, time: 1, data: { reason: { kind: 'cancelled' } } }],
    })
    expect(turns[0].status).toBe('cancelled')
  })

  it('folds approval requests and marks pending state (M3)', () => {
    const turns = buildTurns({
      session: { id: 's1' },
      inheritedEventCount: 0,
      events: [
        userMessage(0, '需要审批的轮'),
        { type: 'approval/asked', seq: 1, time: 1, data: { id: 'ap2', callId: 'c9', toolName: 'bash', reason: 'write' } },
        { type: 'approval/decided', seq: 2, time: 2, data: { id: 'ap2' } },
        { type: 'approval/asked', seq: 3, time: 3, data: { id: 'ap3', toolName: 'web_fetch' } },
        assistantMessage(4, '完成'),
      ],
    })
    expect(turns[0].approvals).toEqual([
      { toolName: 'bash', pending: false },
      { toolName: 'web_fetch', pending: true },
    ])
  })

  it('ignores log-only seed markers and unknown event types', () => {
    const turns = buildTurns({
      session: { id: 's1' },
      inheritedEventCount: 0,
      events: [
        userMessage(0, '问题'),
        { type: 'session/end-seed', seq: 1, time: 1, data: { inherited: true } },
        { type: 'llm/retry', seq: 2, time: 1, data: { whatever: true } },
        assistantMessage(3, '答'),
      ],
    })
    expect(turns).toHaveLength(1)
  })
})

describe('titleFromTurns', () => {
  it('uses the first question as fallback title', () => {
    expect(titleFromTurns(buildTurns({
      session: { id: 's' },
      inheritedEventCount: 0,
      events: [userMessage(0, '这是 很长 很长 很长 很长 很长 很长 很长 很长 的第一句话')],
    }))).toMatch(/^这是 很长/)
  })
})

describe('contentText', () => {
  it('extracts text and labels tool calls', () => {
    expect(contentText([
      { type: 'text', text: 'a' },
      { type: 'tool-call', name: 'bash', arguments: {} },
      { type: 'tool-result', content: [{ type: 'text', text: 'b' }] },
    ])).toBe('a\n[bash]\nb')
  })

  it('textContent keeps reasoning blocks out of answers', () => {
    expect(textContent([
      { type: 'reasoning', text: 'internal thoughts' },
      { type: 'tool-call', name: 'bash' },
      { type: 'text', text: 'visible reply' },
    ])).toBe('visible reply')
  })
})

function turnEnd(seq: number): RawEvent {
  return { type: 'turn/end', seq, time: 1000, data: { reason: { kind: 'completed' } } }
}
