// The single compatibility seam for client-runtime access that goes beyond
// the documented slots contract (D6 glue posture): every fragile internal
// read lives here, degrades explicitly, and never throws into React.
// Verified against DSH 0.2.0-rc.2 (see docs/contract-notes.md).

/** Minimal face of the client `sessions` service (dsh-api-session-controller). */
export interface ClientSessionsFace {
  fork(opts: { sessionId: string; atSeq?: number; increaseTitle?: boolean }): Promise<string>
  create(opts?: { workspaceId?: string; cwd?: string }): Promise<string>
  binding(id: string): { session: { prompt(content: Array<{ type: 'text'; text: string }>, mode: 'queue' | 'steer'): Promise<{ ok?: boolean; error?: { message?: string } }> } } | undefined
  retain(target: string, options?: { source?: unknown }): { ready: Promise<unknown>; session?: unknown; binding?: { session: unknown } }
}

export type OpenTurnResult = 'ok' | 'session-not-in-sidebar' | 'turn-not-found' | 'no-dom'

/** Switch the visible conversation to `sessionId` and scroll to the turn that
 * opened at `seq`. rc.2 deliberately keeps view selection out of the
 * Controller, so the bridge clicks the sidebar row (matched by display title)
 * and then walks the chat DOM's anchor keys (`"<seq>:…" prefix). */
export async function openTurnInConversation(sessionId: string, seq: number, displayTitle: string): Promise<OpenTurnResult> {
  if (typeof document === 'undefined') return 'no-dom'
  const items = Array.from(document.querySelectorAll<HTMLDivElement>('[role="treeitem"]'))
  const wanted = displayTitle.trim()
  const row = items.find(item => {
    const label = (item.getAttribute('aria-label') ?? item.textContent ?? '').trim()
    return wanted !== '' && (label === wanted || label.startsWith(`${wanted} `))
  })
  if (row === undefined) return 'session-not-in-sidebar'
  row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

  // Wait for the conversation view to materialize, then scroll to the turn.
  const deadline = Date.now() + 6000
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 300))
    const anchor = document.querySelector<HTMLElement>(`[data-chat-anchor-key^="${seq}:"]`)
    if (anchor !== null) {
      anchor.scrollIntoView({ block: 'start' })
      return 'ok'
    }
  }
  return 'turn-not-found'
}

/** Send one follow-up user message through the live session binding. */
export async function sendFollowUp(sessions: ClientSessionsFace, sessionId: string, text: string): Promise<void> {
  const binding = sessions.binding?.(sessionId)
  const session = binding?.session
  if (session === undefined) throw new Error('会话未在客户端实例化（请先在原生对话中打开一次）')
  const result = await session.prompt([{ type: 'text', text }], 'queue')
  if (result && result.ok !== true && result.error !== undefined) {
    throw new Error(result.error.message ?? 'DSH 未接受这条消息')
  }
}

/** Fork a session at an exact event seq (inclusive prefix). */
export async function forkSessionAt(sessions: ClientSessionsFace, sessionId: string, atSeq?: number): Promise<string> {
  return sessions.fork({ sessionId, atSeq, increaseTitle: true })
}
