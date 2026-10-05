import { describe, expect, it } from 'vitest'
import { forkAnchorY, lineageNeighborhood, originWorkspaceId, scopedGraph, workspaceSlice, type MapScope } from '../src/client/scope'
import type { GraphDTO, NodeDTO } from '../src/shared/protocol'

const node = (id: string, opts: { ws?: string; parent?: string; sub?: boolean } = {}): NodeDTO => ({
  sessionId: id,
  parentSessionId: opts.parent ?? null,
  title: id,
  workspaceId: opts.ws ?? 'w1',
  cwd: null,
  origin: opts.sub === true ? 'subagent' : null,
  delegationDepth: opts.sub === true ? 1 : 0,
  isSeeded: opts.parent !== undefined,
  createdAt: 0,
})

const graph = (nodes: NodeDTO[], edges: Array<[string, string]> = []): GraphDTO => ({
  workspaces: [
    { workspaceId: 'w1', title: 'w1', path: null },
    { workspaceId: 'w2', title: 'w2', path: null },
  ],
  nodes,
  edges: edges.map(([from, to]) => ({ from, to, kind: 'fork' as const })),
})

describe('originWorkspaceId', () => {
  it('finds the origin workspace', () => {
    expect(originWorkspaceId(graph([node('a', { ws: 'w2' })]), 'a')).toBe('w2')
    expect(originWorkspaceId(graph([node('a')]), 'missing')).toBeNull()
    expect(originWorkspaceId(graph([node('a')]), null)).toBeNull()
  })
})

describe('lineageNeighborhood', () => {
  it('keeps ancestors and descendants but not unrelated sessions, even in the same workspace', () => {
    const g = graph(
      [
        node('root'),
        node('mid', { parent: 'root' }),
        node('origin', { parent: 'mid' }),
        node('child', { parent: 'origin' }),
        node('grandchild', { parent: 'child' }),
        node('unrelated', { parent: 'root' }),
      ],
      [['root', 'mid'], ['mid', 'origin'], ['origin', 'child'], ['child', 'grandchild'], ['root', 'unrelated']],
    )
    const view = lineageNeighborhood(g, 'origin')
    const ids = view.nodes.map(n => n.sessionId).sort()
    expect(ids).toEqual(['child', 'grandchild', 'mid', 'origin', 'root'])
    expect(view.edges).toHaveLength(4)
  })

  it('never crosses the workspace boundary', () => {
    const g = graph([
      node('origin', { ws: 'w1' }),
      node('otherWsRoot', { ws: 'w2' }),
      node('otherWsChild', { ws: 'w2', parent: 'otherWsRoot' }),
    ])
    const view = lineageNeighborhood(g, 'origin')
    expect(view.nodes.map(n => n.sessionId)).toEqual(['origin'])
  })
})

describe('workspaceSlice', () => {
  it('is workspace-isolated', () => {
    const g = graph([node('a', { ws: 'w1' }), node('b', { ws: 'w1' }), node('c', { ws: 'w2' })], [['a', 'b']])
    const view = workspaceSlice(g, 'w1')
    expect(view.nodes.map(n => n.sessionId).sort()).toEqual(['a', 'b'])
    expect(view.edges).toHaveLength(1)
    expect(workspaceSlice(g, null)).toEqual({ ...g, nodes: [], edges: [] })
  })
})

describe('scopedGraph', () => {
  const g = graph([node('a'), node('b', { parent: 'a' }), node('c')], [['a', 'b']])
  it('defaults to the session view when an origin exists', () => {
    const view = scopedGraph(g, 'session' as MapScope, 'a')
    expect(view.nodes.map(n => n.sessionId).sort()).toEqual(['a', 'b'])
  })
  it('expands to the workspace and never above it', () => {
    const view = scopedGraph(g, 'workspace' as MapScope, 'a')
    expect(view.nodes.map(n => n.sessionId).sort()).toEqual(['a', 'b', 'c'])
  })
  it('falls back to the workspace slice without an origin', () => {
    const view = scopedGraph(g, 'session' as MapScope, null)
    expect(view.nodes.map(n => n.sessionId).sort()).toEqual(['a', 'b', 'c'])
  })
})

describe('forkAnchorY', () => {
  const cardPos = {
    'p#8': { top: 40, height: 120 },
    'p#50': { top: 180, height: 90 },
  }
  const list = {
    sessionId: 'p',
    turns: [
      { startSeq: 8, messageId: null, time: 0, question: 'q1', answer: '', tools: [], todoCount: 0, status: 'ok' as const, approvals: [] },
      { startSeq: 50, messageId: null, time: 0, question: 'q2', answer: '', tools: [], todoCount: 0, status: 'ok' as const, approvals: [] },
    ],
  }
  it('anchors the edge to the card covering the cut', () => {
    expect(forkAnchorY(list, 8, cardPos)).toBe(40 + 60)
    expect(forkAnchorY(list, 99, cardPos)).toBe(180 + 45)
  })
  it('falls back to the header without a cut, turns, or a measured card', () => {
    expect(forkAnchorY(list, null, cardPos)).toBeNull()
    expect(forkAnchorY(undefined, 8, cardPos)).toBeNull()
    expect(forkAnchorY(list, 8, {})).toBeNull()
    expect(forkAnchorY({ sessionId: 'p', turns: [], seedSeq: 8 }, 8, cardPos)).toBeNull()
  })
})
