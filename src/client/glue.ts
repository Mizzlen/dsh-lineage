// The single compatibility seam for client-runtime access that goes beyond
// the documented slots contract (D6 glue posture): every fragile internal
// read lives here, degrades explicitly, and never throws into React.
// Verified against DSH 0.2.0-rc.2 (see docs/contract-notes.md).

/** Minimal face of the client `sessions` service (dsh-api-session-controller). */
export interface ClientSessionsFace {
  fork(opts: { sessionId: string; atSeq?: number; increaseTitle?: boolean }): Promise<string>
  create(opts?: { workspaceId?: string; cwd?: string }): Promise<string>
  binding(id: string): {
    session: {
      prompt(content: Array<{ type: 'text'; text: string }>, mode: 'queue' | 'steer'): Promise<{ ok?: boolean; error?: { message?: string } }>
      rename?(title: string): Promise<{ ok?: boolean; error?: { message?: string } }>
    }
  } | undefined
  using<T>(target: string, options: { source: string }, operation: (reference: unknown) => T | Promise<T>): Promise<T>
  retain(target: string, options?: { source?: unknown }): { ready: Promise<unknown>; session?: unknown; binding?: { session: unknown } }
}

export type OpenTurnResult = 'ok' | 'session-switched' | 'session-not-in-sidebar' | 'turn-not-found' | 'no-dom'

/** Switch the visible conversation to `sessionId` and scroll to the turn whose
 * opening user message is `messageId`. rc.2 deliberately keeps view selection
 * out of the Controller, so the bridge clicks the sidebar row (matched by
 * display title) and then locates the chat DOM anchor: native chat renders
 * `data-chat-anchor-key="<surfaceIndex>:input-message<uuid>"`, so the message
 * id is the stable handle (event seqs are not in the key).
 *
 * `isCurrentSession` skips the sidebar entirely: the conversation is already
 * open beneath the map, so after the map closes only the scroll is needed. */
export async function openTurnInConversation(sessionId: string, messageId: string | null, displayTitle: string, isCurrentSession = false): Promise<OpenTurnResult> {
  if (typeof document === 'undefined') return 'no-dom'
  const wanted = displayTitle.trim()
  const anchorSelector = messageId !== null && messageId !== ''
    ? `[data-chat-anchor-key$="input-message${messageId}"]`
    : null
  const scrollWhenPresent = async (timeoutMs: number): Promise<OpenTurnResult> => {
    if (anchorSelector === null) return 'turn-not-found'
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 300))
      const anchor = document.querySelector<HTMLElement>(anchorSelector)
      if (anchor !== null) {
        anchor.scrollIntoView({ block: 'start' })
        return 'ok'
      }
    }
    return 'turn-not-found'
  }

  if (isCurrentSession) {
    // Already the visible conversation: reveal it and scroll, never fail the
    // jump on a missing anchor.
    await scrollWhenPresent(3000)
    return 'ok'
  }

  // Row accessible names compose the title with row-action chrome ("… Session
  // actions for … Archive session Pin session") and a relative time glued on
  // without whitespace ("介绍 otty 工具1h"); forks carry " (1)" inside the
  // title. Strip the chrome, then match exactly so the original never
  // resolves to its fork's row (or vice versa).
  const stripRowChrome = (label: string) => label
    .replace(/\s*Session actions for[\s\S]*$/, '')
    .replace(/\d+(?:min|s|h|d|w)\s*$/i, '')
    .trim()
  // The ACTIVE or just-finished row glues a status word onto the title and a
  // "now" timestamp ("Completed<title>now") that the safe pass cannot strip.
  // Only used as a second pass so titles that legitimately start with one of
  // those words still match the safe way first.
  const stripRowChromeAggressive = (label: string) => stripRowChrome(label)
    .replace(/^(?:completed|running|errored|error|cancelled|canceled|queued|waiting|pinned|archived)\s*/i, '')
    .replace(/\s*(?:just now|now|(?:\d+|a few)?\s*(?:seconds?|minutes?|mins?|hours?|hrs?|days?|weeks?|months?)|today|yesterday)\s*$/i, '')
    .trim()
  const findRow = (): HTMLDivElement | undefined => {
    const items = Array.from(document.querySelectorAll<HTMLDivElement>('[role="treeitem"]'))
    if (wanted === '') return undefined
    return items.find(item => stripRowChrome(item.getAttribute('aria-label') ?? item.textContent ?? '') === wanted)
      ?? items.find(item => stripRowChromeAggressive(item.getAttribute('aria-label') ?? item.textContent ?? '') === wanted)
  }
  const expandTruncatedList = (): boolean => {
    const more = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(button =>
      /more sessions|更多会话|显示更多/i.test(button.textContent?.trim() ?? ''),
    )
    if (more === undefined) return false
    more.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    return true
  }
  // Sessions can also hide inside COLLAPSED workspace groups (a fork child may
  // sit in the "Ungrouped" group while the map is opened from the parent's
  // group, and vice versa). Click every collapsed group row so its sessions
  // render; without this the row bridge reports "not in sidebar" for exactly
  // the parent↔child hops.
  const expandCollapsedGroups = (): boolean => {
    const collapsed = Array.from(document.querySelectorAll<Element>('[role="treeitem"][aria-expanded="false"]'))
    if (collapsed.length === 0) return false
    for (const group of collapsed) {
      group.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    }
    return true
  }
  // Virtualized lists only render visible rows: walk the sessions tree's
  // scrollable ancestor, rescanning after each step.
  const scrollScan = async (): Promise<HTMLDivElement | undefined> => {
    const tree = document.querySelector('[role="tree"]')
    let scroller: HTMLElement | null = null
    for (let el = tree?.parentElement; el !== null && el !== undefined; el = el.parentElement) {
      if (el.scrollHeight > el.clientHeight + 4 && el.clientHeight > 120) { scroller = el; break }
    }
    if (scroller === null) return undefined
    for (let step = 0; step < 30; step += 1) {
      const row = findRow()
      if (row !== undefined) return row
      const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4
      if (atBottom) return undefined
      scroller.scrollTop += Math.max(240, Math.round(scroller.clientHeight * 0.8))
      await new Promise(resolve => setTimeout(resolve, 150))
    }
    return findRow()
  }

  let row = findRow()
  for (let attempt = 0; row === undefined && attempt < 6; attempt += 1) {
    // Truncated lists and collapsed groups both hide rows; expand whichever
    // is present (alternating until neither fires) before rescanning.
    const expanded = expandTruncatedList() || expandCollapsedGroups()
    if (!expanded) break
    await new Promise(resolve => setTimeout(resolve, 250))
    row = findRow()
  }
  if (row === undefined) row = await scrollScan()
  if (row === undefined) {
    // Fail loudly with evidence: the row bridge is version-sensitive, so a
    // miss must be diagnosable from the page itself.
    const items = Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]'))
    ;(window as any).__dshmJumpDebug = {
      wanted,
      treeitemCount: items.length,
      collapsedGroups: document.querySelectorAll('[role="treeitem"][aria-expanded="false"]').length,
      rowLabels: items.map(item => (item.getAttribute('aria-label') ?? item.textContent ?? '').slice(0, 120)),
    }
    console.warn('[dsh-mapper] jump target row not found; see window.__dshmJumpDebug', (window as any).__dshmJumpDebug)
    return 'session-not-in-sidebar'
  }

  // React handlers may sit on an inner row element, not the treeitem itself:
  // dispatch on the deepest label node so the event walks the real handler path.
  const deepest = Array.from(row.querySelectorAll<HTMLElement>('*'))
    .filter(el => el.children.length === 0 && (el.textContent ?? '').trim().startsWith(wanted))
  const clickTarget = deepest.at(-1) ?? row
  clickTarget.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

  const scrolled = await scrollWhenPresent(6000)
  // The session did switch; only the turn anchor may be missing.
  return scrolled === 'turn-not-found' ? 'session-switched' : scrolled
}

/** Send one follow-up user message. The session is materialized on demand
 * via the controller's `using` (same retain source the sidebar uses), so a
 * session that was never opened natively still accepts a follow-up. */
export async function sendFollowUp(sessions: ClientSessionsFace, sessionId: string, text: string): Promise<void> {
  const promptExisting = (): { session?: { prompt(content: Array<{ type: 'text'; text: string }>, mode: 'queue' | 'steer'): Promise<{ ok?: boolean; error?: { message?: string } }> } } | undefined => sessions.binding?.(sessionId)
  const runPrompt = async (session: { prompt(content: Array<{ type: 'text'; text: string }>, mode: 'queue' | 'steer'): Promise<{ ok?: boolean; error?: { message?: string } }> }): Promise<void> => {
    const result = await session.prompt([{ type: 'text', text }], 'queue')
    if (result && result.ok !== true && result.error !== undefined) {
      throw new Error(result.error.message ?? 'DSH 未接受这条消息')
    }
  }

  const existing = promptExisting()?.session
  if (existing !== undefined) return runPrompt(existing)

  if (typeof sessions.using !== 'function') throw new Error('会话未在客户端实例化，且当前版本不支持自动实例化')
  // "workspaceOperation": a fresh retain generation that never collides with
  // the sidebar's open mainView write handle.
  await sessions.using(sessionId, { source: 'workspaceOperation' }, async (reference: unknown) => {
    const binding = (reference as { binding?: { session: unknown } } | null)?.binding
      ?? (sessions.binding?.(sessionId) as { session?: unknown } | undefined)
    const session = (binding?.session ?? (reference as { session?: unknown }).session) as
      | { prompt(content: Array<{ type: 'text'; text: string }>, mode: 'queue' | 'steer'): Promise<{ ok?: boolean; error?: { message?: string } }> }
      | undefined
    if (session === undefined) throw new Error('会话实例化失败，请先在原生对话中打开一次')
    await runPrompt(session)
  })
}

/** Fork a session at an exact event seq (inclusive prefix). */
export async function forkSessionAt(sessions: ClientSessionsFace, sessionId: string, atSeq?: number): Promise<string> {
  return sessions.fork({ sessionId, atSeq, increaseTitle: true })
}

/** Rename a session through the materialized binding's `rename` face —
 * the same normalization and durable `session/title` event as the native
 * row-menu rename. */
export async function renameSession(sessions: ClientSessionsFace, sessionId: string, title: string): Promise<void> {
  const run = async (session: { rename?: (title: string) => Promise<{ ok?: boolean; error?: { message?: string } }> }): Promise<void> => {
    if (typeof session.rename !== 'function') throw new Error('当前版本不支持从地图改名')
    const result = await session.rename(title)
    if (result && result.ok !== true && result.error !== undefined) {
      throw new Error(result.error.message ?? '改名未被执行')
    }
  }
  const binding = sessions.binding?.(sessionId)
  if (binding?.session !== undefined) {
    await run(binding.session)
    return
  }
  // "workspaceOperation" (the native rename's own source) — a fresh retain
  // generation, so an already-open sidebar view never blocks the write handle.
  await sessions.using(sessionId, { source: 'workspaceOperation' }, async (reference: unknown) => {
    const refBinding = (reference as { binding?: { session: unknown } } | null)?.binding
      ?? (sessions.binding?.(sessionId) as { session?: unknown } | undefined)
    const session = (refBinding?.session ?? (reference as { session?: unknown }).session) as
      | { rename?: (title: string) => Promise<{ ok?: boolean; error?: { message?: string } }> }
      | undefined
    if (session === undefined) throw new Error('会话实例化失败，无法改名')
    await run(session)
  })
}
