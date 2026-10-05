// Shared host/client DTOs. Sources of every field are recorded in
// docs/contract-notes.md (SessionHeader/SessionRecord/SessionLogSnapshot from
// @deepseek-ai/dsh-session-query 0.2.0-rc.2; event vocabulary from
// docs/harness/persistence-catalog.md).

/** One question-answer turn folded from the raw session log (D9 card model). */
export interface TurnDTO {
  /** seq of the `user/message` event that opened the turn. */
  startSeq: number
  /** Message id of the opening `user/message` (native chat anchor key). */
  messageId: string | null
  /** Unix epoch ms of the opening user message. */
  time: number
  question: string
  answer: string
  /** Tool invocations folded into this turn, paired by callId. */
  tools: Array<{ name: string; ok: boolean }>
  todoCount: number
  status: 'ok' | 'error' | 'cancelled'
  /** Approval requests folded into this turn; `pending` = asked without a decision. */
  approvals: Array<{ toolName: string | null; pending: boolean }>
}

export interface TurnListDTO {
  sessionId: string
  turns: TurnDTO[]
  /** Fork cut of this session: last inherited event seq (read observation's
   * inheritedEventCount − 1); absent/null when the session owns its whole log. */
  seedSeq?: number | null
}

/** User-dragged lane offsets, persisted per workspace (D8: view metadata only). */
export interface LayoutDocDTO {
  workspaceId: string
  lanes: Record<string, { dx: number; dy: number }>
  updatedAt?: string
}

/** One session node on the map. */
export interface NodeDTO {
  sessionId: string
  parentSessionId: string | null
  title: string
  /** Durable workspace id when the registry groups this session, else null. */
  workspaceId: string | null
  cwd: string | null
  origin: 'subagent' | null
  delegationDepth: number
  isSeeded: boolean
  createdAt: number
  /** True for lazy-branch stubs: no DSH session exists yet. */
  pending?: boolean
}

/** A recorded branch intent; the session appears on first follow-up. */
export interface PendingBranchDTO {
  id: string
  sourceSessionId: string
  atSeq: number | null
  title: string
  workspaceId: string
  createdAt: string
}

/** Fork edge: the child was seeded from `from` at its durable seed cut. */
export interface EdgeDTO {
  from: string
  to: string
  kind: 'fork'
  /** Known fork cut (lazy-branch stubs record it at creation); real forks
   * resolve the cut from the child's turns response `seedSeq` instead. */
  atSeq?: number | null
}

export interface WorkspaceGroupDTO {
  workspaceId: string
  title: string
  path: string | null
}

export interface GraphDTO {
  workspaces: WorkspaceGroupDTO[]
  nodes: NodeDTO[]
  edges: EdgeDTO[]
}

export interface HealthReport {
  ok: true
  plugin: 'dsh-mapper'
  version: string
}

/** Canvas ordering key for one turn inside one session. */
export function turnKey(sessionId: string, seq: number): string {
  return `${sessionId}#${seq}`
}

export function parseTurnKey(key: string): { sessionId: string; seq: number } | null {
  const at = key.lastIndexOf('#')
  if (at <= 0) return null
  const sessionId = key.slice(0, at)
  const seq = Number(key.slice(at + 1))
  if (sessionId === '' || !Number.isSafeInteger(seq) || seq < 0) return null
  return { sessionId, seq }
}
