// Pure graph assembly: corpus records → map nodes and fork edges.
// Shapes verified against @deepseek-ai/dsh-session-query 0.2.0-rc.2
// (SessionRecord/SessionHeader) and @deepseek-ai/dsh-workspace entity getters.
import type { EdgeDTO, GraphDTO, NodeDTO, WorkspaceGroupDTO } from '../shared/protocol'

/** SessionRecord as delivered by sessionQuery.listSessions (subset we rely on). */
export interface RawSessionRecord {
  header?: {
    id?: string
    createdAt?: number
    cwd?: string
    parentSession?: string
    isSeeded?: boolean
    origin?: 'subagent'
    delegationDepth?: number
  }
  live?: boolean
  persisted?: boolean
}

export interface RawWorkspaceEntity {
  workspaceId?: string
  id?: string
  title?: string
  path?: string
  sessionIds?: readonly string[]
}

export interface RegistryFacts {
  workspaces: RawWorkspaceEntity[]
  archivedSessionIds: readonly string[]
}

export interface GraphInputs {
  records: RawSessionRecord[]
  titles: Map<string, string>
  registry: RegistryFacts
}

/**
 * Assemble the map graph:
 * - archived sessions are dropped server-side (synapse #21 fixed at the data source);
 * - workspace groups come from the durable registry; sessions outside every
 *   workspace fall into per-cwd buckets;
 * - fork edges connect only pairs whose parent exists in the corpus.
 */
export function buildGraph(inputs: GraphInputs): GraphDTO {
  const archived = new Set(inputs.registry.archivedSessionIds)
  const nodes: NodeDTO[] = []
  const byId = new Map<string, NodeDTO>()

  const workspaceOfSession = new Map<string, RawWorkspaceEntity>()
  const groups: WorkspaceGroupDTO[] = []
  const groupIds: string[] = []
  const ungrouped = new Map<string, { workspaceId: string; title: string; path: string | null }>()

  for (const workspace of inputs.registry.workspaces) {
    const workspaceId = workspace.workspaceId ?? workspace.id
    if (typeof workspaceId !== 'string' || workspaceId === '') continue
    for (const sessionId of workspace.sessionIds ?? []) {
      if (typeof sessionId === 'string') workspaceOfSession.set(sessionId, workspace)
    }
    groups.push({ workspaceId, title: workspace.title ?? workspaceId, path: workspace.path ?? null })
    groupIds.push(workspaceId)
  }

  for (const record of inputs.records) {
    const header = record?.header
    if (header === undefined) continue
    const sessionId = header.id
    if (typeof sessionId !== 'string' || sessionId === '') continue
    if (archived.has(sessionId)) continue

    let workspaceId: string | null = null
    const owned = workspaceOfSession.get(sessionId)
    if (owned !== undefined) {
      workspaceId = owned.workspaceId ?? owned.id ?? null
    } else {
      const cwd = typeof header.cwd === 'string' && header.cwd !== '' ? header.cwd : '(no workspace)'
      const bucketId = `cwd:${cwd}`
      let bucket = ungrouped.get(bucketId)
      if (bucket === undefined) {
        bucket = { workspaceId: bucketId, title: cwd.split('/').filter(Boolean).at(-1) ?? cwd, path: header.cwd ?? null }
        ungrouped.set(bucketId, bucket)
        groups.push({ workspaceId: bucketId, title: bucket.title, path: bucket.path })
        groupIds.push(bucketId)
      }
      workspaceId = bucketId
    }

    const node: NodeDTO = {
      sessionId,
      parentSessionId: typeof header.parentSession === 'string' && header.parentSession !== '' ? header.parentSession : null,
      title: inputs.titles.get(sessionId) ?? sessionId,
      workspaceId,
      cwd: typeof header.cwd === 'string' ? header.cwd : null,
      origin: header.origin === 'subagent' ? 'subagent' : null,
      delegationDepth: Number.isSafeInteger(header.delegationDepth) ? (header.delegationDepth as number) : 0,
      isSeeded: header.isSeeded === true,
      createdAt: Number.isSafeInteger(header.createdAt) ? (header.createdAt as number) : 0,
    }
    nodes.push(node)
    byId.set(sessionId, node)
  }

  const edges: EdgeDTO[] = []
  for (const node of nodes) {
    if (node.parentSessionId !== null && byId.has(node.parentSessionId)) {
      edges.push({ from: node.parentSessionId, to: node.sessionId, kind: 'fork' })
    }
  }

  return { workspaces: groups, nodes, edges }
}
