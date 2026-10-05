// The conversation map overlay: one lane per session (title bar + vertical
// chain of turn cards), fork edges between lanes, workspace group sections.
// Content is fetched on demand from the Host routes; nothing is cached to
// disk and no polling runs while the map is closed (D6/D8). Lane drag
// offsets persist per workspace through the Host layout routes.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { GraphDTO, LayoutDocDTO, NodeDTO, TurnListDTO } from '../shared/protocol'
import { scopedGraph, type MapScope } from './scope'

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

function fetchTurns(sessionId: string): Promise<TurnListDTO> {
  let entry = turnCache.get(sessionId)
  if (entry === undefined) {
    entry = { promise: fetch(`/mapper/api/sessions/${sessionId}/turns`).then(r => r.json() as Promise<TurnListDTO>) }
    turnCache.set(sessionId, entry)
  }
  return entry.promise
}

export function invalidateTurns(sessionIds: Iterable<string>): void {
  for (const id of sessionIds) turnCache.delete(id)
}

function refetchTurnInto(sessionId: string, apply: (list: TurnListDTO) => void): void {
  turnCache.delete(sessionId)
  void fetchTurns(sessionId).then(apply).catch(() => {})
}

export interface MapActions {
  jump(sessionId: string, messageId: string | null, displayTitle: string, isCurrentSession: boolean): Promise<'ok' | 'session-switched' | 'session-not-in-sidebar' | 'turn-not-found' | 'no-dom'>
  followUp(sessionId: string, text: string): Promise<void>
  forkAt(sessionId: string, atSeq?: number): Promise<string>
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

function edgePath(from: LayoutPosition, to: LayoutPosition): string {
  const x1 = from.x + CARD_W
  const y1 = from.y + LANE_HEADER_H / 2
  const x2 = to.x
  const y2 = to.y + LANE_HEADER_H / 2
  const mid = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`
}

export interface MapPanelProps {
  graph: GraphDTO | null
  error: string | null
  loading: boolean
  runningById: Record<string, boolean>
  actions: MapActions | null
  layouts: Record<string, LayoutDocDTO>
  onOffsetChange: (workspaceId: string, sessionId: string, dx: number, dy: number) => void
  originSessionId: string | null
  onClose: () => void
  onReload: () => void
}

export function MapPanel({ graph, error, loading, runningById, actions, layouts, onOffsetChange, originSessionId, onClose, onReload }: MapPanelProps) {
  const [turns, setTurns] = useState<Map<string, TurnListDTO>>(new Map())
  const [camera, setCamera] = useState({ x: 40, y: 24, scale: 0.9 })
  const [panning, setPanning] = useState(false)
  const [showSubagents, setShowSubagents] = useState(false)
  const [scope, setScope] = useState<MapScope>('session')
  const [followUpFor, setFollowUpFor] = useState<string | null>(null)
  const [toast, setToast] = useState<{ text: string; kind: 'ok' | 'error' } | null>(null)
  const [viewSize, setViewSize] = useState({ w: 1280, h: 720 })
  const [drag, setDrag] = useState<{ sessionId: string; workspaceId: string; baseX: number; baseY: number; dx: number; dy: number } | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const layerRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; camX: number; camY: number } | null>(null)
  const toastTimer = useRef(0)

  const showToast = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    setToast({ text, kind })
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3200)
  }, [])

  // Load turns for every node, bounded to 4 concurrent reads.
  useEffect(() => {
    if (graph === null) return
    let alive = true
    const merged = new Map(turns)
    for (const node of graph.nodes) if (!merged.has(node.sessionId)) merged.set(node.sessionId, { sessionId: node.sessionId, turns: [] })
    setTurns(new Map(merged))
    const next = graph.nodes.map(n => n.sessionId).filter(id => !turns.has(id) || (turns.get(id)?.turns.length ?? 0) === 0)
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
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Real lane heights: cards render at natural size (multi-line text, chips,
  // action rows), so estimates only seed pass one — a layout effect measures
  // actual offsetHeights and feeds them back until stable.
  const [measured, setMeasured] = useState<Record<string, number>>({})

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
    for (const node of graph?.nodes ?? []) {
      const list = turns.get(node.sessionId)
      const count = list === undefined ? 1 : Math.max(1, list.turns.length)
      heights.set(node.sessionId, measured[node.sessionId] ?? LANE_HEADER_H + count * (TURN_H + 18))
    }
    return heights
  }, [graph, turns, measured])

  // Pass two of the layout: after every commit, measure the real lane heights
  // (cards render at natural size) and feed them back. Positions never affect
  // heights, so this converges in one correction. All lanes stay in the DOM —
  // culling would starve the measurement and reintroduce overlap.
  useLayoutEffect(() => {
    const layer = layerRef.current
    if (layer === null) return
    const next: Record<string, number> = {}
    let changed = false
    for (const el of Array.from(layer.querySelectorAll<HTMLElement>('.dshm-lane'))) {
      const id = el.dataset.sessionId
      if (id === undefined || id === '') continue
      const height = el.offsetHeight
      next[id] = height
      if (Math.abs((measured[id] ?? 0) - height) > 1) changed = true
    }
    if (changed) setMeasured(current => ({ ...current, ...next }))
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

  // Scope: session-centric (lineage neighborhood, workspace-isolated) by
  // default; the only drill-up is the workspace map. Never above that.
  const scoped = useMemo(
    () => (graph === null ? null : scopedGraph(graph, scope, originSessionId)),
    [graph, scope, originSessionId],
  )
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
    if (layout === null || graph === null) return
    if (userMovedRef.current) return
    const key = `${scope}:${originSessionId}:${graph.nodes.length}:${turns.size}:${viewSize.w}`
    if (fittedKeyRef.current === key) return
    fittedKeyRef.current = key
    if (scope === 'session') centerOnOrigin(layout)
    else fitToView(layout)
  }, [layout, graph, turns.size, viewSize.w, scope, originSessionId, fitToView, centerOnOrigin])

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
      list.push({ key: `${edge.from}->${edge.to}`, d: edgePath(from, to) })
    }
    return list
  }, [visibleGraph, layout])

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
      if (node.workspaceId !== null && (dx !== origin.dx || dy !== origin.dy)) {
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
    const title = graph?.nodes.find(n => n.sessionId === sessionId)?.title ?? sessionId
    try {
      const result = await actions.jump(sessionId, messageId, title, sessionId === originSessionId)
      if (result === 'ok' || result === 'session-switched') {
        onClose()
        if (result === 'session-switched') showToast('已打开会话，但没定位到那一轮（已停在会话开头）', 'error')
      } else if (result === 'session-not-in-sidebar') {
        showToast('侧栏里找不到这个会话（可能被折叠或归档）', 'error')
      } else {
        showToast('跳转失败', 'error')
      }
    } catch (cause) {
      showToast(`跳转失败：${String(cause)}`, 'error')
    }
  }

  const doFollowUp = async (sessionId: string, text: string) => {
    if (actions === null) return
    try {
      await actions.followUp(sessionId, text)
      setFollowUpFor(null)
      showToast('追问已发送')
      // The answer lands seconds later: pull the session's turns again when
      // it should have completed (the running-flip path covers slow turns).
      const apply = (list: TurnListDTO) => setTurns(current => new Map(current).set(sessionId, list))
      window.setTimeout(() => refetchTurnInto(sessionId, apply), 4000)
      window.setTimeout(() => refetchTurnInto(sessionId, apply), 12000)
    } catch (cause) {
      showToast(`追问失败：${cause instanceof Error ? cause.message : String(cause)}`, 'error')
    }
  }

  const doFork = async (sessionId: string, atSeq: number | undefined) => {
    if (actions === null) return
    try {
      const childId = await actions.forkAt(sessionId, atSeq)
      showToast(`分支已创建：${childId.slice(0, 8)}…（稍后出现在地图上）`)
    } catch (cause) {
      showToast(`分支失败：${cause instanceof Error ? cause.message : String(cause)}`, 'error')
    }
  }

  return (
    <div className="dshm-overlay" role="dialog" aria-label="会话地图">
      <div
        ref={canvasRef}
        className={`dshm-canvas${panning ? ' is-panning' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={() => { userMovedRef.current = false; fittedKeyRef.current = ''; if (scope === 'session') centerOnOrigin(layout); else fitToView(layout) }}
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
          <span className="dshm-hint">{scope === 'session' ? '会话视角（血缘邻域）· ' : '工作区视角 · '}滚轮缩放 · Shift/Alt+滚轮平移 · 拖拽标题移动泳道 · 双击复位</span>
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
                  className={`dshm-lane${isSub ? ' is-sub' : ''}`}
                  style={{ left: pos.x, top: pos.y, width: CARD_W }}
                >
                  <div
                    className={`dshm-session-title${actions !== null ? ' is-grabbable' : ''}`}
                    title={`${node.title}（拖拽移动）`}
                    onPointerDown={event => {
                      // Only the bare header starts a drag; buttons inside opt out.
                      if ((event.target as Element).closest('button') === null) startLaneDrag(event, node)
                    }}
                  >
                    {isSub ? '[sub] ' : ''}
                    {node.isSeeded ? '⑂ ' : ''}
                    {node.title}
                    {runningById[node.sessionId] === true ? <span className="dshm-badge is-running">运行中</span> : null}
                  </div>
                  {actions !== null ? (
                    <div className="dshm-lane-actions">
                      <button type="button" onClick={() => doJump(node.sessionId, list?.turns[0]?.messageId ?? null)}>打开</button>
                      <button type="button" onClick={() => setFollowUpFor(current => (current === node.sessionId ? null : node.sessionId))}>追问</button>
                      <button type="button" onClick={() => doFork(node.sessionId, undefined)}>分支</button>
                    </div>
                  ) : null}
                  {followUpFor === node.sessionId && actions !== null ? (
                    <FollowUpInput onSend={text => doFollowUp(node.sessionId, text)} onCancel={() => setFollowUpFor(null)} />
                  ) : null}
                  {list === undefined ? (
                    <div className="dshm-card"><span className="dshm-loading">读取会话…</span></div>
                  ) : list.turns.length === 0 ? (
                    <div className="dshm-card"><span className="dshm-loading">（无投影轮次：空白或全部为注入内容）</span></div>
                  ) : (
                    list.turns.map(turn => {
                      const badge = statusBadge(turn)
                      const failed = turn.tools.filter(tool => !tool.ok).length
                      const pendingApproval = turn.approvals.filter(a => a.pending).length
                      return (
                        <div key={turn.startSeq} className={`dshm-card${turn.status === 'error' ? ' is-error' : ''}`}>
                          {badge !== null ? <span className={`dshm-badge ${badge.className}`}>{badge.label}</span> : null}
                          <p
                            className="dshm-q"
                            title="点击跳转到原生对话的这一轮"
                            onClick={() => doJump(node.sessionId, turn.messageId)}
                            style={actions !== null ? { cursor: 'pointer' } : undefined}
                          >
                            {turn.question}
                          </p>
                          {turn.answer !== '' ? <p className="dshm-a">{turn.answer}</p> : null}
                          {(turn.tools.length > 0 || turn.todoCount > 0 || turn.approvals.length > 0) ? (
                            <div className="dshm-chips">
                              {turn.tools.slice(0, 4).map((tool, index) => (
                                <span key={index} className={`dshm-chip${tool.ok ? '' : ' is-fail'}`}>{tool.name}</span>
                              ))}
                              {turn.tools.length > 4 ? <span className="dshm-chip">+{turn.tools.length - 4}</span> : null}
                              {failed > 0 ? <span className="dshm-chip is-fail">{failed} 失败</span> : null}
                              {turn.todoCount > 0 ? <span className="dshm-chip">todo×{turn.todoCount}</span> : null}
                              {pendingApproval > 0 ? <span className="dshm-chip is-warn">{pendingApproval} 待审批</span> : null}
                              {actions !== null ? (
                                <button type="button" className="dshm-chip is-branch" onClick={() => doFork(node.sessionId, turn.startSeq)}>⎇ 从此分支</button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      )
                    })
                  )}
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function FollowUpInput({ onSend, onCancel }: { onSend: (text: string) => void; onCancel: () => void }) {
  const [text, setText] = useState('')
  return (
    <div className="dshm-followup">
      <textarea
        autoFocus
        value={text}
        placeholder="追问这个会话…（Enter 发送，Shift+Enter 换行）"
        onChange={event => setText(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            const trimmed = text.trim()
            if (trimmed !== '') onSend(trimmed)
          }
          if (event.key === 'Escape') onCancel()
        }}
      />
      <div className="dshm-followup-bar">
        <button type="button" className="dshm-btn" onClick={() => { const t = text.trim(); if (t !== '') onSend(t) }}>发送</button>
        <button type="button" className="dshm-btn" onClick={onCancel}>取消</button>
      </div>
    </div>
  )
}

function statusBadge(turn: TurnListDTO['turns'][number]): { label: string; className: string } | null {
  if (turn.status === 'error') return { label: '出错', className: 'is-error' }
  if (turn.status === 'cancelled') return { label: '已取消', className: 'is-cancelled' }
  return null
}
