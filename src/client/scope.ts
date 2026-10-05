// Map scope algebra. The plugin's core idea: one lineage tree rooted at a
// root session is ONE map — no logical separation inside it. DSH manages
// sessions flat per workspace, so the lineage map sits between the session
// (centered) tier and the flat workspace tier:
//   血缘图 (lineage, default) — the origin's whole root tree, every node,
//     spanning workspace buckets freely; branch anywhere and it shows up in
//     the same map; any ancestor ↔ any descendant pair is one click apart.
//   工作区 (workspace) — the drill-up: the flat slice of one workspace bucket.
import type { GraphDTO } from '../shared/protocol'
import { turnKey } from '../shared/protocol'

export type MapScope = 'lineage' | 'workspace'

export function originWorkspaceId(graph: GraphDTO, originSessionId: string | null): string | null {
  if (originSessionId === null) return null
  return graph.nodes.find(node => node.sessionId === originSessionId)?.workspaceId ?? null
}

/** The lineage tree that contains `originSessionId`, rooted at its topmost
 * reachable ancestor and including EVERY recursive descendant — ancestors'
 * other branches included. Deliberately ignores workspace attribution: a
 * fork child that landed in a cwd bucket is still the same tree. */
export function rootTree(graph: GraphDTO, originSessionId: string): GraphDTO {
  const byId = new Map(graph.nodes.map(node => [node.sessionId, node]))
  let root = byId.get(originSessionId)
  if (root === undefined) {
    let workspaceId = originWorkspaceId(graph, originSessionId)
    if (workspaceId === null) {
      const first = graph.workspaces.find(workspace => graph.nodes.some(node => node.workspaceId === workspace.workspaceId))
      workspaceId = first?.workspaceId ?? null
    }
    return workspaceSlice(graph, workspaceId)
  }
  const walked = new Set<string>([root.sessionId])
  while (root.parentSessionId !== null && byId.has(root.parentSessionId) && !walked.has(root.parentSessionId)) {
    walked.add(root.parentSessionId)
    root = byId.get(root.parentSessionId) as typeof root
  }

  const childrenOf = new Map<string, string[]>()
  for (const node of graph.nodes) {
    if (node.parentSessionId !== null && byId.has(node.parentSessionId)) {
      const list = childrenOf.get(node.parentSessionId) ?? []
      list.push(node.sessionId)
      childrenOf.set(node.parentSessionId, list)
    }
  }

  const keep = new Set<string>([root.sessionId])
  const stack = [root.sessionId]
  while (stack.length > 0) {
    const id = stack.pop() as string
    for (const child of childrenOf.get(id) ?? []) {
      if (!keep.has(child)) {
        keep.add(child)
        stack.push(child)
      }
    }
  }

  const nodes = graph.nodes.filter(node => keep.has(node.sessionId))
  return { ...graph, nodes, edges: graph.edges.filter(edge => keep.has(edge.from) && keep.has(edge.to)) }
}

/** Workspace view: every session of exactly one workspace bucket, nothing
 * else — the flat tier that mirrors how DSH itself lists sessions. */
export function workspaceSlice(graph: GraphDTO, workspaceId: string | null): GraphDTO {
  const nodes = graph.nodes.filter(node => node.workspaceId === workspaceId)
  const ids = new Set(nodes.map(node => node.sessionId))
  return { ...graph, nodes, edges: graph.edges.filter(edge => ids.has(edge.from) && ids.has(edge.to)) }
}

/** The view for the current scope. Without an origin there is no tree to
 * center on — fall back to the workspace slice of the first workspace that
 * has nodes. */
export function scopedGraph(graph: GraphDTO, scope: MapScope, originSessionId: string | null): GraphDTO {
  if (originSessionId !== null && scope === 'lineage') return rootTree(graph, originSessionId)
  let workspaceId = originWorkspaceId(graph, originSessionId)
  if (workspaceId === null) {
    const first = graph.workspaces.find(workspace => graph.nodes.some(node => node.workspaceId === workspace.workspaceId))
    workspaceId = first?.workspaceId ?? null
  }
  return workspaceSlice(graph, workspaceId)
}

/** Y offset (within the source lane) where a fork edge should leave it: the
 * card covering the fork cut when both the cut and that card's measured
 * position are known, else null (the edge leaves from the lane header). The
 * cut comes from a lazy-branch stub's recorded atSeq or the forked child's
 * turns response seedSeq — both are the last inherited event seq. */
export function forkAnchorY(
  list: { sessionId: string; turns: Array<{ startSeq: number }> } | undefined,
  cut: number | null | undefined,
  cardPos: Record<string, { top: number; height: number }>,
): number | null {
  if (cut === null || cut === undefined || list === undefined) return null
  let best: { startSeq: number } | undefined
  for (const turn of list.turns) {
    if (turn.startSeq <= cut && (best === undefined || turn.startSeq > best.startSeq)) best = turn
  }
  if (best === undefined) return null
  const card = cardPos[turnKey(list.sessionId, best.startSeq)]
  if (card === undefined) return null
  return card.top + card.height / 2
}
