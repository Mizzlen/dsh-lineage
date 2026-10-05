// dsh-lineage client face.
// Two slot entries (contract: docs/contract-notes.md §a):
// - `conversation.session.header.actions` (list / session): the open button;
// - `shell.overlay` (list / root): the full-screen map panel.
// The open state is an apply-closure observable shared by both entries via
// their inject faces; the overlay entry additionally reads the standard
// `useSessions` prop for live ids/running state (slots.md L84-97).
// All beyond-contract client access is confined to glue.ts.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createSource, type Source } from './observable'
import { invalidateTurns, MapPanel, type MapActions } from './MapPanel'
import { forkSessionAt, openTurnInConversation, renameSession, sendFollowUp, type ClientSessionsFace } from './glue'
import { MAP_STYLES } from './styles'
import type { GraphDTO, LayoutDocDTO, PendingBranchDTO } from '../shared/protocol'

export const inject = ['slots', 'sessions'] as const

interface SlotsLike {
  inject(key: string, callback: () => unknown): void
  register(meta: { name: string; id: string; order: number; inject?: () => unknown }, component: (props: any) => any): void
}

function subscribeHook(source: Source<unknown>): () => unknown {
  // Plain-React subscription: setState on change, read snapshot on render.
  return function useOpenState(): unknown {
    const [value, setValue] = useState(() => source.getSnapshot())
    useEffect(() => source.subscribe(() => setValue(source.getSnapshot())), [])
    return value
  }
}

/** Defensive read of the ui-session list snapshot: shapes may drift, live
 * updates are an enhancement, never a crash source (D6 glue posture). */
function extractSessionFacts(snapshot: any): { ids: string[]; running: Record<string, boolean>; titles: Record<string, string> } {
  let ids: string[] = []
  if (Array.isArray(snapshot?.ids)) ids = snapshot.ids.filter((x: unknown) => typeof x === 'string')
  else if (Array.isArray(snapshot)) ids = snapshot.map((entry: any) => entry?.id).filter((x: unknown) => typeof x === 'string')
  const byId = snapshot?.byId
  const running: Record<string, boolean> = {}
  const titles: Record<string, string> = {}
  for (const id of ids) {
    const entry = byId instanceof Map ? byId.get(id) : byId?.[id]
    if (entry?.running === true) running[id] = true
    if (typeof entry?.displayTitle === 'string' && entry.displayTitle !== '') titles[id] = entry.displayTitle
  }
  return { ids, running, titles }
}

function HeaderButton(props: any) {
  return (
    <button type="button" onClick={() => props.open(props.sessionId)} style={{ cursor: 'pointer' }}>
      会话地图
    </button>
  )
}

interface OverlayEntryProps {
  useOpen: () => boolean
  onClose: () => void
  useSessions?: (selector: (value: any) => any) => any
  actions: MapActions | null
  origin: () => string | null
}

function MapOverlayEntry({ useOpen, onClose, useSessions, actions, origin }: OverlayEntryProps) {
  const open = useOpen() === true
  const originSessionId = typeof origin === 'function' ? origin() : null
  const snapshot = typeof useSessions === 'function' ? useSessions((value: any) => value) : undefined
  const facts = useMemo(() => extractSessionFacts(snapshot), [snapshot])

  const [graph, setGraph] = useState<GraphDTO | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [layouts, setLayouts] = useState<Record<string, LayoutDocDTO>>({})
  const [branches, setBranches] = useState<PendingBranchDTO[]>([])
  const load = useCallback(() => {
    setLoading(true)
    void fetch('/lineage/api/graph')
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<GraphDTO>
      })
      .then(body => {
        setGraph(body)
        setError(null)
      })
      .catch(cause => setError(`地图加载失败：${String(cause)}`))
      .finally(() => setLoading(false))
  }, [])

  const refreshBranches = useCallback(() => {
    void fetch('/lineage/api/branches')
      .then(response => (response.ok ? response.json() : { branches: [] }))
      .then((body: { branches: PendingBranchDTO[] }) => setBranches(body.branches ?? []))
      .catch(() => {})
  }, [])

  // Lane offsets: load once per workspace when the graph arrives; write back
  // on drag end (D8: view metadata only).
  const loadedLayouts = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (graph === null || actions === null) return
    refreshBranches()
    for (const group of graph.workspaces) {
      if (loadedLayouts.current.has(group.workspaceId)) continue
      loadedLayouts.current.add(group.workspaceId)
      void fetch(`/lineage/api/layout/${encodeURIComponent(group.workspaceId)}`)
        .then(response => (response.ok ? response.json() : { layout: null }))
        .then((body: { layout: LayoutDocDTO | null }) => {
          if (body.layout !== null) {
            setLayouts(current => ({ ...current, [group.workspaceId]: body.layout as LayoutDocDTO }))
          }
        })
        .catch(() => {})
    }
  }, [graph, actions])

  const onOffsetChange = useCallback((workspaceId: string, sessionId: string, dx: number, dy: number) => {
    setLayouts(current => {
      const lanes = { ...(current[workspaceId]?.lanes ?? {}), [sessionId]: { dx, dy } }
      const doc: LayoutDocDTO = { workspaceId, lanes }
      void fetch(`/lineage/api/layout/${encodeURIComponent(workspaceId)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lanes }),
      }).catch(() => {})
      return { ...current, [workspaceId]: doc }
    })
  }, [])

  // Initial fetch on open; refetch only when the session id set changes.
  const loadedOnce = useRef(false)
  const idsSignature = facts.ids.join(',')
  useEffect(() => {
    if (!open) {
      loadedOnce.current = false
      loadedLayouts.current = new Set()
      return
    }
    if (!loadedOnce.current) {
      loadedOnce.current = true
      load()
    }
  }, [open, load, idsSignature])
  const prevIds = useRef<string | null>(null)
  useEffect(() => {
    if (!open || !loadedOnce.current) {
      prevIds.current = null
      return
    }
    if (prevIds.current !== null && idsSignature !== prevIds.current) load()
    prevIds.current = idsSignature
  }, [open, idsSignature, load])

  // A session stopping means its latest turn changed: drop the cached read.
  const runningRef = useRef<Record<string, boolean>>({})
  useEffect(() => {
    for (const [id, wasRunning] of Object.entries(runningRef.current)) {
      if (wasRunning && facts.running[id] !== true) invalidateTurns([id])
    }
    runningRef.current = facts.running
  }, [facts])

  if (!open) return null
  return (
    <MapPanel
      graph={graph}
      branches={branches}
      error={error}
      loading={loading}
      runningById={facts.running}
      actions={actions}
      layouts={layouts}
      onOffsetChange={onOffsetChange}
      onBranchesChanged={refreshBranches}
      originSessionId={originSessionId}
      onClose={onClose}
      onReload={load}
    />
  )
}

export function apply(ctx: { effect(fn: () => () => void, id?: string): void; slots: SlotsLike; sessions?: ClientSessionsFace }): void {
  const openSource: Source<boolean> & { set(value: boolean): void } = createSource(false)
  // The session whose header button opened the map (session-scoped slot prop).
  const originRef: { current: string | null } = { current: null }

  const actions: MapActions | null = ctx.sessions
    ? {
        jump: (sessionId, messageId, displayTitle, isCurrentSession, opts) => openTurnInConversation(sessionId, messageId, displayTitle, isCurrentSession, opts),
        followUp: (sessionId, text) => sendFollowUp(ctx.sessions as ClientSessionsFace, sessionId, text),
        renameSession: (sessionId, title) => renameSession(ctx.sessions as ClientSessionsFace, sessionId, title),
        createBranch: input => fetch('/lineage/api/branches', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        }).then(async response => {
          if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? `HTTP ${response.status}`)
          return (await response.json()).branch as PendingBranchDTO
        }),
        renameBranch: (id, title) => fetch(`/lineage/api/branches/${id}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title }),
        }).then(async response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
        }),
        deleteBranch: id => fetch(`/lineage/api/branches/${id}`, { method: 'DELETE' }).then(async response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
        }),
        activateBranch: async (stub, text) => {
          const sessions = ctx.sessions as ClientSessionsFace
          const childId = await forkSessionAt(sessions, stub.sourceSessionId, stub.atSeq ?? undefined)
          await sendFollowUp(sessions, childId, text)
          // Carry the stub's chosen name onto the real session; failure is
          // non-fatal (the session keeps the inherited incremented title).
          await renameSession(sessions, childId, stub.title).catch(() => {})
          await fetch(`/lineage/api/branches/${stub.id}`, { method: 'DELETE' }).catch(() => {})
          return { sessionId: childId }
        },
      }
    : null

  const style = document.createElement('style')
  style.textContent = MAP_STYLES
  document.head.append(style)
  // macOS desktop shells draw traffic lights over full-screen overlays; the
  // map's topbar indents itself clear of them.
  const isMac = /\bMac\b/.test(navigator.platform) || /Macintosh/.test(navigator.userAgent)
  if (isMac) document.documentElement.classList.add('dshm-mac')

  // Documented registration pattern (docs/harness/subsystems/slots.md L38-45,
  // inject option on the register meta per the shipped web-search bundle).
  // Each contribution is isolated: one failing registration must not break the
  // other, and failures surface on the console instead of dying silently.
  const contribute = (key: string, meta: { name: string; id: string; order: number; inject?: () => unknown }, component: (props: any) => any) => {
    ctx.slots.inject(key, () => {
      try {
        ctx.slots.register(meta, component)
      } catch (error) {
        console.error('[dsh-lineage] slot registration failed:', meta.name, error)
        ;(window as any).__dshmRegisterError = { slot: meta.name, error: String(error) }
      }
    })
  }

  contribute('conversation.session.header.actions', {
    name: 'conversation.session.header.actions',
    id: 'dsh-lineage-open',
    order: 900,
    inject: () => ({
      open: (sessionId: unknown) => {
        originRef.current = typeof sessionId === 'string' ? sessionId : null
        openSource.set(true)
      },
    }),
  }, HeaderButton)
  contribute('shell.overlay', {
    name: 'shell.overlay',
    id: 'dsh-lineage-map',
    order: 60,
    inject: () => ({ onClose: () => openSource.set(false), useOpen: subscribeHook(openSource), actions, origin: () => originRef.current }),
  }, MapOverlayEntry as any)

  ctx.effect(() => () => {
    style.remove()
    if (isMac) document.documentElement.classList.remove('dshm-mac')
  }, 'dsh-lineage: styles')
}
