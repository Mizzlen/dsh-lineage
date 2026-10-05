// Map scope algebra (v0.0.2 logic change): the map is workspace-isolated.
// Opening from a session yields a session-centric view (the session's lineage
// neighborhood inside its workspace); the only drill-up is the workspace map.
// There is deliberately no level above the workspace.
import type { GraphDTO } from '../shared/protocol'

export type MapScope = 'session' | 'workspace'

export function originWorkspaceId(graph: GraphDTO, originSessionId: string | null): string | null {
  if (originSessionId === null) return null
  return graph.nodes.find(node => node.sessionId === originSessionId)?.workspaceId ?? null
}

/** Session-centric view: the origin session, its ancestor chain and its
 * recursive fork descendants — every node confined to the origin's workspace. */
export function lineageNeighborhood(graph: GraphDTO, originSessionId: string): GraphDTO {
  const origin = graph.nodes.find(node => node.sessionId === originSessionId)
  if (origin === undefined) return graph
  const inWorkspace = graph.nodes.filter(node => node.workspaceId === origin.workspaceId)
  const byId = new Map(inWorkspace.map(node => [node.sessionId, node]))
  const childrenOf = new Map<string, string[]>()
  for (const node of inWorkspace) {
    if (node.parentSessionId !== null) {
      const list = childrenOf.get(node.parentSessionId) ?? []
      list.push(node.sessionId)
      childrenOf.set(node.parentSessionId, list)
    }
  }

  const keep = new Set<string>([origin.sessionId])
  let cursor: (typeof inWorkspace)[number] | undefined = origin
  while (cursor !== undefined && cursor.parentSessionId !== null) {
    const parent = byId.get(cursor.parentSessionId)
    if (parent === undefined) break
    keep.add(parent.sessionId)
    cursor = parent
  }
  const stack = [origin.sessionId]
  while (stack.length > 0) {
    const id = stack.pop() as string
    for (const child of childrenOf.get(id) ?? []) {
      if (!keep.has(child)) {
        keep.add(child)
        stack.push(child)
      }
    }
  }

  const nodes = inWorkspace.filter(node => keep.has(node.sessionId))
  const ids = new Set(nodes.map(node => node.sessionId))
  return { ...graph, nodes, edges: graph.edges.filter(edge => ids.has(edge.from) && ids.has(edge.to)) }
}

/** Workspace view: every session of exactly one workspace, nothing else. */
export function workspaceSlice(graph: GraphDTO, workspaceId: string | null): GraphDTO {
  const nodes = graph.nodes.filter(node => node.workspaceId === workspaceId)
  const ids = new Set(nodes.map(node => node.sessionId))
  return { ...graph, nodes, edges: graph.edges.filter(edge => ids.has(edge.from) && ids.has(edge.to)) }
}

/** The view for the current scope. Without an origin there is no session
 * center to speak of — fall back to the workspace slice of the first
 * workspace that has nodes. */
export function scopedGraph(graph: GraphDTO, scope: MapScope, originSessionId: string | null): GraphDTO {
  if (originSessionId !== null && scope === 'session') return lineageNeighborhood(graph, originSessionId)
  let workspaceId = originWorkspaceId(graph, originSessionId)
  if (workspaceId === null) {
    const first = graph.workspaces.find(workspace => graph.nodes.some(node => node.workspaceId === workspace.workspaceId))
    workspaceId = first?.workspaceId ?? null
  }
  return workspaceSlice(graph, workspaceId)
}
