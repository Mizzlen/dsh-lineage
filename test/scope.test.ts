import { describe, expect, it } from 'vitest'
import { forkAnchorY, originWorkspaceId, rootTree, scopedGraph, workspaceSlice, type MapScope } from '../src/client/scope'
import type { GraphDTO, NodeDTO, TurnListDTO } from '../src/shared/protocol'

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

describe('rootTree', () => {
  it('takes the WHOLE tree from the root: ancestors, their other branches, all descendants', () => {
    const g = graph(
      [
        node('root'),
        node('mid', { parent: 'root' }),
        node('origin', { parent: 'mid' }),
        node('sibling', { parent: 'mid' }),
        node('child', { parent: 'origin' }),
        node('grandchild', { parent: 'child' }),
        node('unrelated'),
      ],
      [['root', 'mid'], ['mid', 'origin'], ['mid', 'sibling'], ['origin', 'child'], ['child', 'grandchild']],
    )
    const view = rootTree(g, 'origin')
    const ids = view.nodes.map(n => n.sessionId).sort()
    expect(ids).toEqual(['child', 'grandchild', 'mid', 'origin', 'root', 'sibling'])
    expect(view.edges).toHaveLength(5)
  })

  it('is NOT workspace-isolated: a lineage crossing buckets stays one map', () => {
    // A fork child whose workspace attach failed lives in a cwd bucket —
    // it is still the same tree (the v0.0.6 confusion this fixes).
    const g = graph([
      node('root', { ws: 'w1' }),
      node('child', { ws: 'cwd:/tmp/x', parent: 'root' }),
      node('grandchild', { ws: 'w1', parent: 'child' }),
      node('elsewhere', { ws: 'w2' }),
    ])
    const view = rootTree(g, 'grandchild')
    expect(view.nodes.map(n => n.sessionId).sort()).toEqual(['child', 'grandchild', 'root'])
  })

  it('stops at a missing (e.g. archived) ancestor and roots there', () => {
    const g = graph([node('origin', { parent: 'archived' }), node('other')])
    const view = rootTree(g, 'origin')
    expect(view.nodes.map(n => n.sessionId)).toEqual(['origin'])
  })

  it('falls back to the origin workspace slice when the origin is absent', () => {
    const g = graph([node('a'), node('b', { ws: 'w2' })])
    const missing: TurnListDTO = { sessionId: 'missing', turns: [], seedSeq: 8 }
    expect(rootTree(g, 'missing').nodes.map(n => n.sessionId)).toEqual(['a'])
    expect(forkAnchorY(missing, 8, {})).toBeNull()
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
  const g = graph([node('a'), node('b', { parent: 'a' }), node('s', { parent: 'a' }), node('c')], [['a', 'b'], ['a', 's']])
  it('defaults to the lineage tree (whole root tree) when an origin exists', () => {
    const view = scopedGraph(g, 'lineage' as MapScope, 'b')
    expect(view.nodes.map(n => n.sessionId).sort()).toEqual(['a', 'b', 's'])
  })
  it('expands to the workspace and never above it', () => {
    const view = scopedGraph(g, 'workspace' as MapScope, 'a')
    expect(view.nodes.map(n => n.sessionId).sort()).toEqual(['a', 'b', 'c', 's'])
  })
  it('falls back to the workspace slice without an origin', () => {
    const view = scopedGraph(g, 'lineage' as MapScope, null)
    expect(view.nodes.map(n => n.sessionId).sort()).toEqual(['a', 'b', 'c', 's'])
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
      { startSeq: 8, endSeq: 40, messageId: null, time: 0, question: 'q1', answer: '', tools: [], todoCount: 0, status: 'ok' as const, approvals: [] },
      { startSeq: 50, endSeq: 99, messageId: null, time: 0, question: 'q2', answer: '', tools: [], todoCount: 0, status: 'ok' as const, approvals: [] },
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
    const empty: TurnListDTO = { sessionId: 'p', turns: [], seedSeq: 8 }
    expect(forkAnchorY(empty, 8, cardPos)).toBeNull()
  })
})
