import { describe, expect, it } from 'vitest'
import { buildGraph, type RawSessionRecord, type RegistryFacts } from '../src/server/graph'

const session = (id: string, opts: { parent?: string; cwd?: string; createdAt?: number } = {}): RawSessionRecord => ({
  header: {
    id,
    createdAt: opts.createdAt ?? 1000,
    cwd: opts.cwd ?? '/repo',
    parentSession: opts.parent,
    isSeeded: opts.parent !== undefined,
  },
  live: true,
  persisted: true,
})

const registry = (over: Partial<RegistryFacts> = {}): RegistryFacts => ({
  workspaces: [{ workspaceId: 'w1', title: 'repo', path: '/repo', sessionIds: ['s1'] }],
  archivedSessionIds: [],
  ...over,
})

describe('buildGraph', () => {
  it('groups by registry membership and buckets ungrouped sessions by cwd', () => {
    const graph = buildGraph({
      records: [session('s1'), session('s2', { cwd: '/other', createdAt: 2000 })],
      titles: new Map([['s1', '标题一']]),
      registry: registry(),
    })
    expect(graph.workspaces.map(w => w.workspaceId)).toEqual(['w1', 'cwd:/other'])
    expect(graph.nodes).toHaveLength(2)
    expect(graph.nodes[0]).toMatchObject({ sessionId: 's1', title: '标题一', workspaceId: 'w1' })
    expect(graph.nodes[1]).toMatchObject({ sessionId: 's2', workspaceId: 'cwd:/other' })
  })

  it('drops archived sessions server-side (synapse #21 regression)', () => {
    const graph = buildGraph({
      records: [session('s1'), session('s2')],
      titles: new Map(),
      registry: registry({ archivedSessionIds: ['s2'] }),
    })
    expect(graph.nodes.map(n => n.sessionId)).toEqual(['s1'])
    expect(graph.edges).toEqual([])
  })

  it('emits fork edges only when the parent exists in the corpus', () => {
    const graph = buildGraph({
      records: [session('s1'), session('s2', { parent: 's1' }), session('s3', { parent: 'ghost' })],
      titles: new Map(),
      registry: registry(),
    })
    expect(graph.edges).toEqual([{ from: 's1', to: 's2', kind: 'fork' }])
  })

  it('carries subagent metadata through', () => {
    const graph = buildGraph({
      records: [{ header: { id: 'sa', cwd: '/repo', origin: 'subagent', delegationDepth: 2, createdAt: 5 } }],
      titles: new Map(),
      registry: registry(),
    })
    expect(graph.nodes[0]).toMatchObject({ origin: 'subagent', delegationDepth: 2 })
  })
})
