// The single compatibility seam for client-runtime access that goes beyond
// the documented slots contract (D6 glue posture): every fragile internal
// read lives here, degrades explicitly, and never throws into React.
// Verified against DSH 0.2.0-rc.2 (see docs/contract-notes.md).

/** Minimal face of the client `sessions` service (dsh-api-session-controller). */
export interface ClientSessionsFace {
  fork(opts: { sessionId: string; atSeq?: number; increaseTitle?: boolean }): Promise<string>
  create(opts?: { workspaceId?: string; cwd?: string }): Promise<string>
  binding(id: string): { session: { prompt(content: Array<{ type: 'text'; text: string }>, mode: 'queue' | 'steer'): Promise<{ ok?: boolean; error?: { message?: string } }> } } | undefined
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
  const findRow = (): HTMLDivElement | undefined => {
    const items = Array.from(document.querySelectorAll<HTMLDivElement>('[role="treeitem"]'))
    return items.find(item => wanted !== '' && stripRowChrome(item.getAttribute('aria-label') ?? item.textContent ?? '') === wanted)
  }
  const expandTruncatedList = (): boolean => {
    const more = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(button =>
      /more sessions|更多会话|显示更多/i.test(button.textContent?.trim() ?? ''),
    )
    if (more === undefined) return false
    more.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
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
  for (let attempt = 0; row === undefined && attempt < 4; attempt += 1) {
    if (!expandTruncatedList()) break
    await new Promise(resolve => setTimeout(resolve, 250))
    row = findRow()
  }
  if (row === undefined) row = await scrollScan()
  if (row === undefined) return 'session-not-in-sidebar'

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
  await sessions.using(sessionId, { source: 'mainView' }, async (reference: unknown) => {
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
