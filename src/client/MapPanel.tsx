// The conversation map overlay: one lane per session (title bar + vertical
// chain of turn cards), fork edges between lanes, workspace group sections.
// Content is fetched on demand from the Host routes; nothing is cached to
// disk and no polling runs while the map is closed (D6/D8). Lane drag
// offsets persist per workspace through the Host layout routes.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { GraphDTO, LayoutDocDTO, NodeDTO, PendingBranchDTO, TurnDTO, TurnListDTO } from '../shared/protocol'
import { turnKey } from '../shared/protocol'
import { forkAnchorY, scopedGraph, type MapScope } from './scope'
import { renderMarkdown } from './markdown'

const CARD_W = 300
const TURN_H = 96
const LANE_HEADER_H = 38
const LANE_MIN_H = 150
const GAP_X = 90
const GAP_Y = 46
const GROUP_GAP = 110

interface TurnCacheEntry {
  promise: Promise<TurnListDTO>
}
const turnCache = new Map<string, TurnCacheEntry>()
const fullTurnCache = new Map<string, TurnCacheEntry>()

function fetchTurns(sessionId: string, full = false): Promise<TurnListDTO> {
  const cache = full ? fullTurnCache : turnCache
  let entry = cache.get(sessionId)
  if (entry === undefined) {
    entry = {
      promise: fetch(`/mapper/api/sessions/${sessionId}/turns${full ? '?full=1' : ''}`).then(r => r.json() as Promise<TurnListDTO>),
    }
    cache.set(sessionId, entry)
  }
  return entry.promise
}

export function invalidateTurns(sessionIds: Iterable<string>): void {
  for (const id of sessionIds) {
    turnCache.delete(id)
    fullTurnCache.delete(id)
  }
}

function refetchTurnInto(sessionId: string, apply: (list: TurnListDTO) => void, full = false): void {
  const cache = full ? fullTurnCache : turnCache
  cache.delete(sessionId)
  void fetchTurns(sessionId, full).then(apply).catch(() => {})
}

export interface MapActions {
  jump(sessionId: string, messageId: string | null, displayTitle: string, isCurrentSession: boolean): Promise<'ok' | 'session-switched' | 'session-not-in-sidebar' | 'turn-not-found' | 'no-dom'>
  followUp(sessionId: string, text: string): Promise<void>
  renameSession(sessionId: string, title: string): Promise<void>
  createBranch(input: { sourceSessionId: string; atSeq: number | null; title: string; workspaceId: string }): Promise<PendingBranchDTO>
  renameBranch(id: string, title: string): Promise<void>
  deleteBranch(id: string): Promise<void>
  /** Materialize a lazy branch: fork the source, send the first follow-up,
   * drop the stub. The real session appears through the normal refresh. */
  activateBranch(stub: PendingBranchDTO, text: string): Promise<{ sessionId: string }>
}

interface LayoutPosition {
  x: number
  y: number
  laneHeight: number
}

interface LayoutResult {
  positions: Map<string, LayoutPosition>
  groups: Array<{ id: string; title: string; y: number }>
  width: number
  height: number
}

/** Deterministic tidy-ish forest per workspace group: lanes at tree depth ×
 * column width, leaves stacked vertically, parent aligned to its first child.
 * User offsets (dx, dy) translate a lane away from its automatic spot. */
export function layoutGraph(
  graph: GraphDTO,
  laneHeights: Map<string, number>,
  offsets: Record<string, { dx: number; dy: number }>,
): LayoutResult {
  const positions = new Map<string, LayoutPosition>()
  const groups: Array<{ id: string; title: string; y: number }> = []
  const childrenOf = new Map<string, NodeDTO[]>()
  const inGroup = new Map<string, NodeDTO[]>()
  const laneHeight = (id: string) => laneHeights.get(id) ?? LANE_MIN_H

  for (const node of graph.nodes) {
    const key = node.workspaceId ?? '(none)'
    const list = inGroup.get(key) ?? []
    list.push(node)
    inGroup.set(key, list)
    if (node.parentSessionId !== null) {
      const children = childrenOf.get(node.parentSessionId) ?? []
      children.push(node)
      childrenOf.set(node.parentSessionId, children)
    }
  }

  let cursorY = 56
  let maxX = 0
  let maxY = 0
  for (const group of graph.workspaces) {
    const nodes = inGroup.get(group.workspaceId)
    if (nodes === undefined || nodes.length === 0) continue
    groups.push({ id: group.workspaceId, title: group.title, y: cursorY - 34 })
    const groupTop = cursorY
    const byId = new Map(nodes.map(n => [n.sessionId, n]))
    const ordered = [...nodes].sort((a, b) => a.createdAt - b.createdAt)
    const seen = new Set<string>()
    let leafY = groupTop

    const visit = (node: NodeDTO, depth: number): number => {
      seen.add(node.sessionId)
      const x = depth * (CARD_W + GAP_X)
      maxX = Math.max(maxX, x + CARD_W)
      const ownHeight = laneHeight(node.sessionId)
      const children = (childrenOf.get(node.sessionId) ?? []).filter(c => byId.has(c.sessionId) && !seen.has(c.sessionId))
      let y: number
      if (children.length === 0) {
        y = leafY
        leafY = y + ownHeight + GAP_Y
      } else {
        // Children reserve vertical space first; the parent aligns to its
        // first child but its own card stack must not overlap rows below —
        // the subtree reserves max(child span, own height).
        let firstChildY = Number.POSITIVE_INFINITY
        for (const child of children) {
          firstChildY = Math.min(firstChildY, visit(child, depth + 1))
        }
        y = firstChildY
        leafY = Math.max(leafY, y + ownHeight + GAP_Y)
      }
      maxY = Math.max(maxY, y + ownHeight)
      positions.set(node.sessionId, { x, y, laneHeight: ownHeight })
      return y
    }

    for (const node of ordered) {
      const parentInGroup = node.parentSessionId !== null && byId.has(node.parentSessionId)
      if (!parentInGroup && !seen.has(node.sessionId)) visit(node, 0)
    }
    cursorY = leafY + GROUP_GAP
  }

  // Apply user offsets after layout; grow the bounds to keep fit-to-view honest.
  for (const [sessionId, pos] of positions) {
    const offset = offsets[sessionId]
    if (offset !== undefined) {
      pos.x += offset.dx
      pos.y += offset.dy
    }
    maxX = Math.max(maxX, pos.x + CARD_W)
    maxY = Math.max(maxY, pos.y + pos.laneHeight)
  }

  return { positions, groups, width: maxX + 120, height: Math.max(maxY, cursorY) + 120 }
}

function edgePath(from: LayoutPosition, to: LayoutPosition, anchorY: number | null = null): string {
  const x1 = from.x + CARD_W
  const y1 = from.y + (anchorY ?? LANE_HEADER_H / 2)
  const x2 = to.x
  const y2 = to.y + LANE_HEADER_H / 2
  const mid = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`
}

export interface MapPanelProps {
  graph: GraphDTO | null
  branches: PendingBranchDTO[]
  error: string | null
  loading: boolean
  runningById: Record<string, boolean>
  actions: MapActions | null
  layouts: Record<string, LayoutDocDTO>
  onOffsetChange: (workspaceId: string, sessionId: string, dx: number, dy: number) => void
  onBranchesChanged: () => void
  originSessionId: string | null
  onClose: () => void
  onReload: () => void
}

export function MapPanel({ graph, branches, error, loading, runningById, actions, layouts, onOffsetChange, onBranchesChanged, originSessionId, onClose, onReload }: MapPanelProps) {
  const [turns, setTurns] = useState<Map<string, TurnListDTO>>(new Map())
  const [camera, setCamera] = useState({ x: 40, y: 24, scale: 0.9 })
  const [panning, setPanning] = useState(false)
  const [showSubagents, setShowSubagents] = useState(false)
  const [scope, setScope] = useState<MapScope>('session')
  const [reader, setReader] = useState<{
    sessionId: string
    turn: TurnDTO
    /** Screen rect of the clicked card: the float card animates out of it. */
    sourceRect: { left: number; top: number; width: number; height: number }
  } | null>(null)
  const [inputFor, setInputFor] = useState<{ kind: 'rename' | 'renameBranch'; sessionId: string } | null>(null)
  const [readerLoading, setReaderLoading] = useState(false)

  // Merge lazy-branch stubs into the graph as pending nodes: they inherit the
  // source's workspace and lineage, so scoping naturally includes them.
  const mergedGraph = useMemo(() => {
    if (graph === null) return null
    if (branches.length === 0) return graph
    const byId = new Map(graph.nodes.map(n => [n.sessionId, n]))
    const nodes = [...graph.nodes]
    const edges = [...graph.edges]
    for (const stub of branches) {
      const source = byId.get(stub.sourceSessionId)
      if (source === undefined) continue
      if (nodes.some(n => n.sessionId === stub.id)) continue
      nodes.push({
        sessionId: stub.id,
        parentSessionId: stub.sourceSessionId,
        title: stub.title,
        workspaceId: source.workspaceId,
        cwd: source.cwd,
        origin: null,
        delegationDepth: source.delegationDepth,
        isSeeded: true,
        createdAt: Date.parse(stub.createdAt) || 0,
        pending: true,
      })
      edges.push({ from: stub.sourceSessionId, to: stub.id, kind: 'fork', atSeq: stub.atSeq })
    }
    return { ...graph, nodes, edges }
  }, [graph, branches])

  // Scope: session-centric (lineage neighborhood, workspace-isolated) by
  // default; the only drill-up is the workspace map. Never above that.
  const scoped = useMemo(
    () => (mergedGraph === null ? null : scopedGraph(mergedGraph, scope, originSessionId)),
    [mergedGraph, scope, originSessionId],
  )
  const [followUpFor, setFollowUpFor] = useState<string | null>(null)
  const [toast, setToast] = useState<{ text: string; kind: 'ok' | 'error' } | null>(null)
  const [viewSize, setViewSize] = useState({ w: 1280, h: 720 })
  const [drag, setDrag] = useState<{ sessionId: string; workspaceId: string; baseX: number; baseY: number; dx: number; dy: number } | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const layerRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; camX: number; camY: number } | null>(null)
  const toastTimer = useRef(0)
  // Title/card single clicks wait out a possible double click; a lane drag
  // that ends on the title suppresses the synthetic click entirely.
  const clickTimer = useRef(0)
  const dragMovedRef = useRef(false)

  const showToast = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    setToast({ text, kind })
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3200)
  }, [])

  // Load turns for every real node, bounded to 4 concurrent reads.
  useEffect(() => {
    if (mergedGraph === null) return
    let alive = true
    const merged = new Map(turns)
    for (const node of mergedGraph.nodes) {
      if (node.pending === true) continue
      if (!merged.has(node.sessionId)) merged.set(node.sessionId, { sessionId: node.sessionId, turns: [] })
    }
    setTurns(new Map(merged))
    const next = mergedGraph.nodes
      .filter(n => n.pending !== true)
      .map(n => n.sessionId)
      .filter(id => !turns.has(id) || (turns.get(id)?.turns.length ?? 0) === 0)
    let active = 0
    const pump = () => {
      if (!alive) return
      while (active < 4 && next.length > 0) {
        const id = next.shift()
        if (id === undefined) return
        active += 1
        void fetchTurns(id)
          .then(list => {
            merged.set(id, list)
          })
          .catch(() => {
            merged.set(id, { sessionId: id, turns: [] })
          })
          .finally(() => {
            active -= 1
            if (alive) {
              setTurns(new Map(merged))
              pump()
            }
          })
      }
    }
    pump()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph])

  // Track viewport size for centering and fit-to-view. The overlay is
  // position:fixed inset:0, so the window IS the canvas; measuring the
  // element caught mid-mount layout and froze stale numbers.
  useEffect(() => {
    const measure = () => setViewSize({ w: window.innerWidth, h: window.innerHeight })
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Wheel: plain = zoom to cursor, shift = horizontal pan, alt = vertical pan.
  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      userMovedRef.current = true
      if (event.shiftKey || event.altKey) {
        setCamera(cam => ({
          ...cam,
          x: cam.x + (event.shiftKey ? -event.deltaY : -event.deltaX),
          y: cam.y + (event.altKey ? -event.deltaY : -event.deltaX),
        }))
        return
      }
      setCamera(cam => {
        const nextScale = Math.min(2.5, Math.max(0.15, cam.scale * Math.exp(-event.deltaY * 0.0016)))
        const rect = canvas.getBoundingClientRect()
        const px = event.clientX - rect.left
        const py = event.clientY - rect.top
        const wx = (px - cam.x) / cam.scale
        const wy = (py - cam.y) / cam.scale
        return { x: px - wx * nextScale, y: py - wy * nextScale, scale: nextScale }
      })
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // The reading float owns Esc first; only when it is closed does the map exit.
      if (reader !== null) setReader(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, reader])

  // Real lane heights and per-card offsets: cards render at natural size
  // (multi-line text, chips, action rows), so estimates only seed pass one —
  // the layout effect below measures offsetHeights and feeds them back.
  const [measured, setMeasured] = useState<Record<string, number>>({})
  const [cardPos, setCardPos] = useState<Record<string, { top: number; height: number }>>({})

  // A session's running flip true→false means its latest turn changed:
  // refresh that lane's cards right away.
  const panelRunningRef = useRef<Record<string, boolean>>({})
  useEffect(() => {
    const stopped = Object.entries(panelRunningRef.current)
      .filter(([id, wasRunning]) => wasRunning && runningById[id] !== true)
      .map(([id]) => id)
    panelRunningRef.current = runningById
    if (stopped.length === 0) return
    for (const id of stopped) {
      refetchTurnInto(id, list => setTurns(current => new Map(current).set(id, list)))
    }
  }, [runningById])

  const laneHeights = useMemo(() => {
    const heights = new Map<string, number>()
    for (const node of mergedGraph?.nodes ?? []) {
      const list = turns.get(node.sessionId)
      const count = list === undefined ? 1 : Math.max(1, list.turns.length)
      heights.set(node.sessionId, measured[node.sessionId] ?? LANE_HEADER_H + count * (TURN_H + 18))
    }
    return heights
  }, [mergedGraph, turns, measured])

  // Pass two of the layout: after every commit, measure the real lane heights
  // (cards render at natural size) and feed them back. Positions never affect
  // heights, so this converges in one correction. All lanes stay in the DOM —
  // culling would starve the measurement and reintroduce overlap. Turn cards
  // are measured too (offset within their lane) so fork edges can leave from
  // the exact card covering the fork cut instead of the lane header.
  useLayoutEffect(() => {
    const layer = layerRef.current
    if (layer === null) return
    const next: Record<string, number> = {}
    const nextCards: Record<string, { top: number; height: number }> = {}
    let changed = false
    let cardsChanged = false
    for (const el of Array.from(layer.querySelectorAll<HTMLElement>('.dshm-lane'))) {
      const id = el.dataset.sessionId
      if (id === undefined || id === '') continue
      const height = el.offsetHeight
      next[id] = height
      if (Math.abs((measured[id] ?? 0) - height) > 1) changed = true
      for (const card of Array.from(el.querySelectorAll<HTMLElement>('.dshm-card[data-seq]'))) {
        const seq = Number(card.dataset.seq)
        if (!Number.isSafeInteger(seq)) continue
        const entry = { top: card.offsetTop, height: card.offsetHeight }
        const key = turnKey(id, seq)
        nextCards[key] = entry
        const prev = cardPos[key]
        if (prev === undefined || Math.abs(prev.top - entry.top) > 1 || Math.abs(prev.height - entry.height) > 1) cardsChanged = true
      }
    }
    if (changed) setMeasured(current => ({ ...current, ...next }))
    if (cardsChanged) setCardPos(current => ({ ...current, ...nextCards }))
  })

  const mergedOffsets = useMemo(() => {
    const merged: Record<string, { dx: number; dy: number }> = {}
    for (const doc of Object.values(layouts)) {
      for (const [sessionId, offset] of Object.entries(doc.lanes ?? {})) {
        merged[sessionId] = offset
      }
    }
    if (drag !== null) merged[drag.sessionId] = { dx: drag.dx, dy: drag.dy }
    return merged
  }, [layouts, drag])

  const visibleGraph = useMemo(() => {
    if (scoped === null) return null
    if (showSubagents) return scoped
    return { ...scoped, nodes: scoped.nodes.filter(n => n.origin !== 'subagent' && (n.delegationDepth ?? 0) === 0) }
  }, [scoped, showSubagents])

  const layout = useMemo(
    () => (visibleGraph === null ? null : layoutGraph(visibleGraph, laneHeights, mergedOffsets)),
    [visibleGraph, laneHeights, mergedOffsets],
  )

  const fitToView = useCallback((layoutResult: LayoutResult | null) => {
    if (layoutResult === null || layoutResult.width <= 0) return
    const scale = Math.min(1, Math.max(0.15, viewSize.w / (layoutResult.width + 80)))
    setCamera({ x: (viewSize.w - layoutResult.width * scale) / 2, y: 20, scale })
  }, [viewSize.w])

  // Session scope puts the origin lane in the middle of the screen at full
  // size; the workspace view fits everything.
  const centerOnOrigin = useCallback((layoutResult: LayoutResult | null) => {
    if (layoutResult === null || originSessionId === null) return fitToView(layoutResult)
    const pos = layoutResult.positions.get(originSessionId)
    if (pos === undefined) return fitToView(layoutResult)
    setCamera({
      x: Math.round(viewSize.w / 2 - (pos.x + CARD_W / 2)),
      y: Math.round(Math.max(20, viewSize.h / 2 - (pos.y + LANE_HEADER_H + 60))),
      scale: 1,
    })
  }, [originSessionId, viewSize.w, viewSize.h, fitToView])

  const fittedKeyRef = useRef<string>('')
  const userMovedRef = useRef(false)
  useEffect(() => {
    if (layout === null || mergedGraph === null) return
    if (userMovedRef.current) return
    const key = `${scope}:${originSessionId}:${mergedGraph.nodes.length}:${turns.size}:${viewSize.w}`
    if (fittedKeyRef.current === key) return
    fittedKeyRef.current = key
    if (scope === 'session') centerOnOrigin(layout)
    else fitToView(layout)
  }, [layout, mergedGraph, turns.size, viewSize.w, scope, originSessionId, fitToView, centerOnOrigin])

  const toggleScope = () => {
    setScope(current => (current === 'session' ? 'workspace' : 'session'))
    userMovedRef.current = false
    fittedKeyRef.current = ''
  }

  const edges = useMemo(() => {
    const list: Array<{ key: string; d: string }> = []
    if (layout === null || visibleGraph === null) return list
    for (const edge of visibleGraph.edges) {
      const from = layout.positions.get(edge.from)
      const to = layout.positions.get(edge.to)
      if (from === undefined || to === undefined) continue
      // Fork cut: stubs carry it on the edge; real forks carry it on the
      // child's turns response. Anchored edges leave from the cut's card.
      const cut = edge.atSeq ?? turns.get(edge.to)?.seedSeq ?? null
      const anchorY = forkAnchorY(turns.get(edge.from), cut, cardPos)
      list.push({ key: `${edge.from}->${edge.to}`, d: edgePath(from, to, anchorY) })
    }
    return list
  }, [visibleGraph, layout, turns, cardPos])

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.target !== (event.currentTarget as Element)) return
    userMovedRef.current = true
    dragRef.current = { startX: event.clientX, startY: event.clientY, camX: camera.x, camY: camera.y }
    setPanning(true)
    ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: React.PointerEvent) => {
    const canvasDrag = dragRef.current
    if (canvasDrag === null) return
    setCamera(cam => ({ ...cam, x: canvasDrag.camX + (event.clientX - canvasDrag.startX), y: canvasDrag.camY + (event.clientY - canvasDrag.startY) }))
  }
  const onPointerUp = () => {
    dragRef.current = null
    setPanning(false)
  }

  const startLaneDrag = (event: React.PointerEvent, node: NodeDTO) => {
    if (event.button !== 0 || actions === null) return
    dragMovedRef.current = false
    const pos = layout?.positions.get(node.sessionId)
    const autoX = pos !== undefined ? pos.x - (mergedOffsets[node.sessionId]?.dx ?? 0) : 0
    const autoY = pos !== undefined ? pos.y - (mergedOffsets[node.sessionId]?.dy ?? 0) : 0
    const start = { x: event.clientX, y: event.clientY }
    const origin = { dx: mergedOffsets[node.sessionId]?.dx ?? 0, dy: mergedOffsets[node.sessionId]?.dy ?? 0 }
    const target = event.currentTarget as Element
    target.setPointerCapture(event.pointerId)
    const onMove = (moveEvent: Event) => {
      const pointer = moveEvent as PointerEvent
      const dx = Math.round(origin.dx + (pointer.clientX - start.x) / camera.scale)
      const dy = Math.round(origin.dy + (pointer.clientY - start.y) / camera.scale)
      setDrag({ sessionId: node.sessionId, workspaceId: node.workspaceId ?? '', baseX: autoX, baseY: autoY, dx, dy })
    }
    const onUp = (upEvent: Event) => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      const pointer = upEvent as PointerEvent
      const dx = Math.round(origin.dx + (pointer.clientX - start.x) / camera.scale)
      const dy = Math.round(origin.dy + (pointer.clientY - start.y) / camera.scale)
      setDrag(null)
      // A drag that ends on the title must not read as its click (open).
      dragMovedRef.current = dx !== origin.dx || dy !== origin.dy
      if (node.workspaceId !== null && dragMovedRef.current) {
        onOffsetChange(node.workspaceId, node.sessionId, dx, dy)
      }
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
  }

  const doJump = async (sessionId: string, messageId: string | null) => {
    if (actions === null) return
    // A turn-less fork (no owned events) still opens the session — without a
    // scroll target the map closes and the toast says so.
    const title = mergedGraph?.nodes.find(n => n.sessionId === sessionId)?.title ?? sessionId
    try {
      const result = await actions.jump(sessionId, messageId, title, sessionId === originSessionId)
      if (result === 'ok' || result === 'session-switched') {
        onClose()
        if (result === 'session-switched') showToast('已打开会话，但没定位到那一轮（已停在会话开头）', 'error')
      } else if (result === 'session-not-in-sidebar') {
        showToast('侧栏里找不到这个会话（详情见控制台 __dshmJumpDebug）', 'error')
      } else {
        showToast('跳转失败', 'error')
      }
    } catch (cause) {
      showToast(`跳转失败：${String(cause)}`, 'error')
    }
  }

  const doFollowUp = async (sessionId: string, text: string): Promise<void> => {
    if (actions === null) return
    try {
      await actions.followUp(sessionId, text)
      showToast('追问已发送')
      // The answer lands seconds later: pull the session's turns again when
      // it should have completed (the running-flip path covers slow turns).
      const apply = (list: TurnListDTO) => setTurns(current => new Map(current).set(sessionId, list))
      window.setTimeout(() => refetchTurnInto(sessionId, apply), 4000)
      window.setTimeout(() => refetchTurnInto(sessionId, apply), 12000)
    } catch (cause) {
      showToast(`追问失败：${cause instanceof Error ? cause.message : String(cause)}`, 'error')
      throw cause
    }
  }

  // Lazy fork: record a branch stub; the session appears on first follow-up.
  const doCreateBranch = async (node: NodeDTO, atSeq: number | null) => {
    if (actions === null || node.workspaceId === null) {
      showToast('这条泳道无法创建分支', 'error')
      return
    }
    try {
      await actions.createBranch({
        sourceSessionId: node.sessionId,
        atSeq,
        title: `${node.title} 分支`,
        workspaceId: node.workspaceId,
      })
      showToast('分支已记录（创建会话推迟到第一次追问）')
      onBranchesChanged()
    } catch (cause) {
      showToast(`分支失败：${cause instanceof Error ? cause.message : String(cause)}`, 'error')
    }
  }

  const doDeleteBranch = async (id: string) => {
    if (actions === null) return
    try {
      await actions.deleteBranch(id)
      showToast('分支存根已移除')
      onBranchesChanged()
    } catch (cause) {
      showToast(`移除失败：${String(cause)}`, 'error')
    }
  }

  const doRenameSession = async (sessionId: string, title: string) => {
    if (actions === null) return
    try {
      await actions.renameSession(sessionId, title)
      setInputFor(null)
      showToast('已改名（原生侧稍后同步显示）')
      window.setTimeout(onReload, 600)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      showToast(
        /active write handle/.test(message)
          ? '该会话正被另一个窗口/面板占用，请在那边关闭该会话后再改名'
          : `改名失败：${message}`,
        'error',
      )
    }
  }

  const doRenameBranch = async (id: string, title: string) => {
    if (actions === null) return
    try {
      await actions.renameBranch(id, title)
      setInputFor(null)
      showToast('分支已改名')
      onBranchesChanged()
    } catch (cause) {
      showToast(`改名失败：${cause instanceof Error ? cause.message : String(cause)}`, 'error')
    }
  }

  // First follow-up on a stub materializes the real session.
  const doActivateBranch = async (stub: PendingBranchDTO, text: string): Promise<void> => {
    if (actions === null) return
    try {
      const { sessionId } = await actions.activateBranch(stub, text)
      showToast(`分支已创建为会话 ${sessionId.slice(0, 8)}…，追问已发送`)
      onBranchesChanged()
      window.setTimeout(onReload, 400)
    } catch (cause) {
      showToast(`追问失败：${cause instanceof Error ? cause.message : String(cause)}`, 'error')
      throw cause
    }
  }

  const openReader = (sessionId: string, turn: TurnDTO, card: Element | null) => {
    const rect = card?.getBoundingClientRect()
    setReader({
      sessionId,
      turn,
      sourceRect: rect !== undefined
        ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
        : { left: viewSize.w / 2 - 160, top: viewSize.h / 2 - 90, width: 320, height: 180 },
    })
    if (actions === null) return
    setReaderLoading(true)
    void fetchTurns(sessionId, true)
      .then(list => {
        const full = list.turns.find(t => t.startSeq === turn.startSeq)
        if (full !== undefined) setReader(current => (current === null ? current : { ...current, turn: full }))
      })
      .catch(() => {})
      .finally(() => setReaderLoading(false))
  }

  return (
    <div className="dshm-overlay" role="dialog" aria-label="会话地图">
      <div
        ref={canvasRef}
        className={`dshm-canvas${panning ? ' is-panning' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={event => {
          // Double click inside an input is text selection, never a view reset.
          if ((event.target as Element).closest('textarea, input') !== null) return
          userMovedRef.current = false; fittedKeyRef.current = ''; if (scope === 'session') centerOnOrigin(layout); else fitToView(layout)
        }}
      >
        <div className="dshm-topbar">
          <button type="button" className="dshm-btn" onClick={onClose}>返回对话（Esc）</button>
          <button type="button" className="dshm-btn" onClick={onReload}>刷新</button>
          {originSessionId !== null ? (
            <button type="button" className="dshm-btn" onClick={toggleScope}>
              {scope === 'session' ? '展开为工作区地图' : '回到会话中心'}
            </button>
          ) : null}
          <button type="button" className="dshm-btn" onClick={() => setShowSubagents(value => !value)}>
            {showSubagents ? '隐藏 subagent' : '显示 subagent'}
          </button>
          <span className="dshm-hint">{scope === 'session' ? '会话视角（血缘邻域）· ' : '工作区视角 · '}滚轮缩放 · Shift/Alt+滚轮平移 · 拖拽标题移动泳道 · 标题单击打开/双击改名 · 双击卡片展开阅读 · 双击空白复位</span>
          {loading ? <span className="dshm-hint">加载中…</span> : null}
          {error !== null ? <span className="dshm-hint" style={{ color: '#b42323' }}>{error}</span> : null}
        </div>
        {toast !== null ? (
          <div className={`dshm-toast${toast.kind === 'error' ? ' is-error' : ''}`}>{toast.text}</div>
        ) : null}
        {layout !== null ? (
          <div ref={layerRef} className="dshm-layer" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})` }}>
            {layout.groups.map(group => (
              <div key={group.id} className="dshm-group-label" style={{ top: group.y, left: 0, width: layout.width }}>
                ▤ {group.title}
              </div>
            ))}
            <svg className="dshm-edges" width={Math.max(layout.width, 1)} height={Math.max(layout.height, 1)} style={{ left: 0, top: 0 }}>
              {edges.map(({ key, d }) => (
                <path key={key} className="dshm-edge" d={d} />
              ))}
            </svg>
            {visibleGraph?.nodes.map(node => {
              const pos = layout.positions.get(node.sessionId)
              if (pos === undefined) return null
              const list = turns.get(node.sessionId)
              const isSub = node.origin === 'subagent' || (node.delegationDepth ?? 0) > 0
              return (
                <div
                  key={node.sessionId}
                  data-session-id={node.sessionId}
                  className={`dshm-lane${isSub ? ' is-sub' : ''}${node.pending === true ? ' is-pending' : ''}`}
                  style={{ left: pos.x, top: pos.y, width: CARD_W }}
                >
                  <div
                    className={`dshm-session-title${actions !== null ? ' is-grabbable' : ''}`}
                    title={node.pending === true ? `${node.title}（双击改名 · 拖拽移动）` : `${node.title}（单击打开 · 双击改名 · 拖拽移动）`}
                    onPointerDown={event => {
                      // Only the bare header starts a drag; buttons inside opt out.
                      if ((event.target as Element).closest('button') === null) startLaneDrag(event, node)
                    }}
                    onClick={event => {
                      if (actions === null || node.pending === true) return
                      if ((event.target as Element).closest('button') !== null) return
                      if (dragMovedRef.current) { dragMovedRef.current = false; return }
                      // 单击打开：等一拍让位给双击改名。
                      window.clearTimeout(clickTimer.current)
                      clickTimer.current = window.setTimeout(() => { void doJump(node.sessionId, list?.turns[0]?.messageId ?? null) }, 260)
                    }}
                    onDoubleClick={event => {
                      if ((event.target as Element).closest('button') !== null) return
                      event.stopPropagation()
                      window.clearTimeout(clickTimer.current)
                      if (actions === null) return
                      setInputFor(current => (current?.sessionId === node.sessionId && (current.kind === 'rename' || current.kind === 'renameBranch') ? null : { kind: node.pending === true ? 'renameBranch' : 'rename', sessionId: node.sessionId }))
                    }}
                  >
                    {isSub ? '[sub] ' : ''}
                    {node.pending === true ? '◇ ' : node.isSeeded ? '⑂ ' : ''}
                    {node.title}
                    {runningById[node.sessionId] === true ? <span className="dshm-badge is-running">运行中</span> : null}
                    {node.pending === true && actions !== null ? (
                      <button type="button" className="dshm-title-x" title="删除分支存根" onClick={() => doDeleteBranch(node.sessionId)}>✕</button>
                    ) : null}
                  </div>
                  {inputFor !== null && inputFor.sessionId === node.sessionId && (inputFor.kind === 'rename' || inputFor.kind === 'renameBranch') ? (
                    inputFor.kind === 'renameBranch' ? (
                      <InputRow
                        placeholder="新的分支名…（Enter 确认）"
                        initial=""
                        onSend={(text: string) => doRenameBranch(node.sessionId, text)}
                        onCancel={() => setInputFor(null)}
                      />
                    ) : (
                      <InputRow
                        placeholder="新的会话标题…（Enter 确认）"
                        initial={node.title}
                        onSend={(text: string) => doRenameSession(node.sessionId, text)}
                        onCancel={() => setInputFor(null)}
                      />
                    )
                  ) : null}
                  {list === undefined && node.pending !== true ? (
                    <div className="dshm-card"><span className="dshm-loading">读取会话…</span></div>
                  ) : null}
                  {list !== undefined && list.turns.length === 0 && node.pending !== true ? (
                    <div className="dshm-card">
                      <span className="dshm-loading">（无投影轮次：空白或全部为注入内容）</span>
                    </div>
                  ) : null}
                  {list !== undefined && list.turns.length > 0
                    ? list.turns.map(turn => {
                      const badge = statusBadge(turn)
                      const failed = turn.tools.filter(tool => !tool.ok).length
                      const pendingApproval = turn.approvals.filter(a => a.pending).length
                      return (
                        <div
                          key={turn.startSeq}
                          data-seq={turn.startSeq}
                          className={`dshm-card${turn.status === 'error' ? ' is-error' : ''}`}
                          onClick={event => {
                            const target = event.target as Element
                            if (target.closest('button') !== null || target.closest('.dshm-followup') !== null) return
                            if (actions === null || target.closest('.dshm-q') === null) return
                            if (dragMovedRef.current) { dragMovedRef.current = false; return }
                            // 单击问题跳转：与双击展开阅读共享裁决定时器。
                            window.clearTimeout(clickTimer.current)
                            clickTimer.current = window.setTimeout(() => { void doJump(node.sessionId, turn.messageId) }, 260)
                          }}
                          onDoubleClick={event => {
                            const target = event.target as Element
                            if (target.closest('button') !== null || target.closest('.dshm-followup') !== null) return
                            event.stopPropagation()
                            window.clearTimeout(clickTimer.current)
                            if (actions === null) return
                            openReader(node.sessionId, turn, event.currentTarget)
                          }}
                        >
                          {badge !== null ? <span className={`dshm-badge ${badge.className}`}>{badge.label}</span> : null}
                          <p className="dshm-q" title={actions !== null ? '单击跳转到原生对话的这一轮 · 双击展开阅读' : undefined}>
                            {turn.question}
                          </p>
                          {turn.answer !== '' ? <p className="dshm-a">{turn.answer}</p> : null}
                          <div className="dshm-chips">
                            {turn.tools.slice(0, 4).map((tool, index) => (
                              <span key={index} className={`dshm-chip${tool.ok ? '' : ' is-fail'}`}>{tool.name}</span>
                            ))}
                            {turn.tools.length > 4 ? <span className="dshm-chip">+{turn.tools.length - 4}</span> : null}
                            {failed > 0 ? <span className="dshm-chip is-fail">{failed} 失败</span> : null}
                            {turn.todoCount > 0 ? <span className="dshm-chip">todo×{turn.todoCount}</span> : null}
                            {pendingApproval > 0 ? <span className="dshm-chip is-warn">{pendingApproval} 待审批</span> : null}
                          </div>
                          {actions !== null ? (
                            <button
                              type="button"
                              className="dshm-branch-btn"
                              title="从此分支（从这一轮分叉，连线由此按钮引出）"
                              onClick={() => doCreateBranch(node, turn.startSeq)}
                            >
                              &gt;
                            </button>
                          ) : null}
                        </div>
                      )
                    })
                    : null}
                  {/* 队列尾部的追问卡：整个卡片就是一个输入框。对存根而言，
                    第一次追问即物化为真会话；对中间轮次的追问走「>」分支。 */}
                  {actions !== null ? (
                    <AskCard
                      placeholder={node.pending === true ? '第一次追问——此刻才真正创建这个分支的会话（Enter 发送）' : '追问这个会话…（Enter 发送，Shift+Enter 换行）'}
                      onSend={text => (node.pending === true
                        ? doActivateBranch(branches.find(b => b.id === node.sessionId) as PendingBranchDTO, text)
                        : doFollowUp(node.sessionId, text))}
                    />
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
      {/* Reading float lives OUTSIDE the canvas element on purpose: the map's
        wheel-zoom listener sits on the canvas, so wheel events over the float
        scroll the float's body instead of zooming the map behind it. */}
      {reader !== null ? (
        <>
          <div className="dshm-reader-scrim" onClick={() => setReader(null)} />
          <ReaderCard reader={reader} loading={readerLoading} onClose={() => setReader(null)} />
        </>
      ) : null}
    </div>
  )
}

/** The expanded-reading card: rises from the clicked card's rect to the
 * foreground center (FLIP on mount), floating over a dimmed backdrop. */
function ReaderCard({ reader, loading, onClose }: {
  reader: { sessionId: string; turn: TurnDTO; sourceRect: { left: number; top: number; width: number; height: number } }
  loading: boolean
  onClose: () => void
}) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    const el = cardRef.current
    if (el === null) return
    const rect = el.getBoundingClientRect()
    const src = reader.sourceRect
    const dx = src.left + src.width / 2 - (rect.left + rect.width / 2)
    const dy = src.top + src.height / 2 - (rect.top + rect.height / 2)
    const scale = Math.max(0.2, Math.min(1, src.width / Math.max(rect.width, 1)))
    el.style.transition = 'none'
    el.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${scale})`
    void el.getBoundingClientRect()
    const raf = requestAnimationFrame(() => {
      el.style.transition = 'transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)'
      el.style.transform = 'translate(-50%, -50%)'
    })
    return () => cancelAnimationFrame(raf)
    // Mount-only: the float must animate once per open, not per content load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div ref={cardRef} className="dshm-reader" role="dialog" aria-label="展开阅读">
      <div className="dshm-reader-bar">
        <span className="dshm-reader-title">{reader.turn.question.slice(0, 48)}</span>
        <button type="button" className="dshm-btn" onClick={onClose}>关闭</button>
      </div>
      <div className="dshm-reader-body dshm-md">
        {loading ? <span className="dshm-hint">加载全文…</span> : null}
        <div className="dshm-reader-q">{renderMarkdown(reader.turn.question)}</div>
        {reader.turn.answer !== '' ? <div className="dshm-reader-a">{renderMarkdown(reader.turn.answer)}</div> : null}
      </div>
    </div>
  )
}

/** The trailing ask card: the whole card is one input. Enter sends,
 * Shift+Enter breaks a line; the box grows with its content and clears on
 * success — on failure the text stays (the toast explains why). */
function AskCard({ placeholder, onSend }: { placeholder: string; onSend: (text: string) => Promise<void> }) {
  const [text, setText] = useState('')
  const areaRef = useRef<HTMLTextAreaElement | null>(null)
  const send = async () => {
    const trimmed = text.trim()
    if (trimmed === '') return
    try {
      await onSend(trimmed)
      setText('')
      if (areaRef.current !== null) areaRef.current.style.height = 'auto'
    } catch {
      // onSend already toasted the failure; keep the text for a retry.
    }
  }
  return (
    <div className="dshm-card is-ask">
      <textarea
        ref={areaRef}
        rows={1}
        value={text}
        placeholder={placeholder}
        onChange={event => {
          setText(event.target.value)
          const el = event.target
          el.style.height = 'auto'
          el.style.height = `${Math.min(160, el.scrollHeight)}px`
        }}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            void send()
          }
        }}
      />
    </div>
  )
}

function InputRow({ onSend, onCancel, placeholder, initial }: { onSend: (text: string) => void; onCancel: () => void; placeholder: string; initial: string }) {
  const [text, setText] = useState(initial)
  return (
    <div className="dshm-followup">
      <input
        autoFocus
        type="text"
        value={text}
        placeholder={placeholder}
        onChange={event => setText(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault()
            const trimmed = text.trim()
            if (trimmed !== '') onSend(trimmed)
          }
          if (event.key === 'Escape') onCancel()
        }}
        style={{ height: 28, borderRadius: 6, border: '1px solid #94a3b8', padding: '0 8px', fontSize: 12 }}
      />
    </div>
  )
}

function statusBadge(turn: TurnListDTO['turns'][number]): { label: string; className: string } | null {
  if (turn.status === 'error') return { label: '出错', className: 'is-error' }
  if (turn.status === 'cancelled') return { label: '已取消', className: 'is-cancelled' }
  return null
}
