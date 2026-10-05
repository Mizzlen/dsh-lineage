// dsh-mapper host face.
// Reads the durable session corpus through the documented seams
// (ctx.sessionQuery, ctx.workspaceRegistry — docs/contract-notes.md §b/§c) and
// serves it to the Web client map. The plugin stores nothing on the Host
// side: content is read on demand, DSH remains the only source of truth.
import { buildTurns, type RawSessionLog } from './server/project'
import { buildGraph, type RawSessionRecord } from './server/graph'
import { LayoutStore } from './server/layout-store'
import type { GraphDTO, HealthReport, LayoutDocDTO, TurnListDTO } from './shared/protocol'

export const name = 'dsh-mapper'

export const inject = ['webServer', 'sessionQuery', 'workspaceRegistry'] as const

const VERSION = '0.0.2'

interface ServerResponse {
  writeHead(status: number, headers: Record<string, string>): unknown
  end(body?: string): unknown
}
interface ServerRequest {
  url?: string
  headers?: Record<string, unknown>
  method?: string
}

interface WebServerLike {
  register(route: {
    kind: 'exact' | 'prefix'
    path: string
    handler: (req: ServerRequest, res: ServerResponse) => void | Promise<void>
  }): () => void
}

interface SessionQueryLike {
  listSessions(): Promise<RawSessionRecord[]>
  readSession(sessionId: string): Promise<RawSessionLog>
  readTitleSnapshots(ids: readonly string[]): Promise<Array<Record<string, any>>>
}

interface WorkspaceRegistryLike {
  list(): Array<Record<string, any>>
  archivedSessionIds: readonly string[]
}

interface Ctx {
  effect(fn: () => () => void, id?: string): void
  logger?: { warn(error: Error): void; error(error: Error): void }
  webServer: WebServerLike
  sessionQuery: SessionQueryLike
  workspaceRegistry: WorkspaceRegistryLike
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

const MAX_BODY_BYTES = 256 * 1024

async function readJson(req: ServerRequest): Promise<any> {
  const reqAny = req as unknown as { [Symbol.asyncIterator](): AsyncIterator<Buffer> }
  const chunks: Buffer[] = []
  let length = 0
  for await (const chunk of reqAny) {
    length += chunk.length
    if (length > MAX_BODY_BYTES) throw new InputError('请求内容过大')
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new InputError('请求不是有效 JSON')
  }
}

class InputError extends Error {}
class NotFoundError extends Error {}

/** Mirror of the DSH /api browser-trust fence: /mapper/* routes sit outside
 * it, so the Host header is checked here (localhost default, config opt-in). */
function hostAllowed(headers: ServerRequest['headers'], trusted: Set<string>): boolean {
  const raw = typeof headers?.host === 'string' ? headers.host : ''
  const hostname = raw.replace(/:\d+$/, '').toLowerCase()
  return trusted.has(hostname)
}

export function apply(ctx: Ctx, config?: { trustedHosts?: unknown; dataDir?: unknown }): void {
  const dataDir = typeof config?.dataDir === 'string' && config.dataDir.trim() !== '' ? config.dataDir : undefined
  const layouts = dataDir !== undefined ? new LayoutStore(dataDir) : null
  const trusted = new Set<string>(['localhost', '127.0.0.1'])
  if (Array.isArray(config?.trustedHosts)) {
    for (const host of config.trustedHosts) {
      if (typeof host === 'string' && host.trim() !== '') trusted.add(host.trim().toLowerCase())
    }
  }

  const page = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>dsh-mapper</title></head><body><p>dsh-mapper is mounted. API: <a href="/mapper/api/graph">/mapper/api/graph</a></p></body></html>`

  const fetchGraph = async (): Promise<GraphDTO> => {
    const records = await ctx.sessionQuery.listSessions()
    const ids = records
      .map(record => record?.header?.id)
      .filter((id): id is string => typeof id === 'string' && id !== '')
    let titles = new Map<string, string>()
    try {
      const results = await ctx.sessionQuery.readTitleSnapshots(ids)
      for (const result of results) {
        const observation = result?.status === 'fulfilled' ? result.value : result
        const title = observation?.title?.title
        const id = observation?.session?.id ?? observation?.sessionId
        if (typeof title === 'string' && title !== '' && typeof id === 'string') titles.set(id, title)
      }
    } catch {
      titles = new Map()
    }
    const graph = buildGraph({
      records,
      titles,
      registry: {
        workspaces: ctx.workspaceRegistry.list(),
        archivedSessionIds: ctx.workspaceRegistry.archivedSessionIds,
      },
    })
    return graph
  }

  const fetchTurns = async (sessionId: string): Promise<TurnListDTO> => {
    if (!/^[A-Za-z0-9_-]+$/.test(sessionId)) throw new InputError('非法会话 id')
    const log = await ctx.sessionQuery.readSession(sessionId)
    return { sessionId, turns: buildTurns(log) }
  }

  const api = async (req: ServerRequest, res: ServerResponse): Promise<void> => {
    if (!hostAllowed(req.headers, trusted)) return void sendJson(res, 403, { error: '不被信任的 Host' })
    const path = new URL(req.url ?? '/', 'http://dsh.local').pathname
    if (path === '/mapper/api/graph' && req.method === 'GET') {
      return void sendJson(res, 200, await fetchGraph())
    }
    const turns = /^\/mapper\/api\/sessions\/([A-Za-z0-9_-]+)\/turns$/.exec(path)
    if (turns !== null && req.method === 'GET') {
      return void sendJson(res, 200, await fetchTurns(turns[1]))
    }
    const layout = /^\/mapper\/api\/layout\/(.+)$/.exec(path)
    if (layout !== null && layouts !== null) {
      const workspaceId = decodeURIComponent(layout[1])
      if (req.method === 'GET') {
        const doc = await layouts.get(workspaceId)
        return void sendJson(res, 200, { layout: doc })
      }
      if (req.method === 'PUT') {
        const body = await readJson(req)
        const doc = await layouts.put(workspaceId, body?.lanes)
        return void sendJson(res, 200, { layout: doc })
      }
    }
    return void sendJson(res, 404, { error: '接口不存在' })
  }

  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/mapper', handler: (_req, res) => { res.writeHead(302, { location: '/mapper/' }); res.end() } }), 'dsh-mapper: redirect')
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/mapper/', handler: (_req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(page) } }), 'dsh-mapper: page')
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/mapper/api/health', handler: (_req, res) => sendJson(res, 200, { ok: true, plugin: name, version: VERSION } satisfies HealthReport) }), 'dsh-mapper: health')
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: '/mapper/api', handler: api }), 'dsh-mapper: api')
}

export { buildTurns, buildGraph }
