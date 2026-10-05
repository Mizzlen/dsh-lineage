// Per-workspace lane-offset persistence (D8: view metadata only, never
// message content). One small JSON file per workspace id under the plugin
// data dir; atomic tmp+rename writes.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { LayoutDocDTO } from '../shared/protocol'

const MAX_LANES = 2000

export class LayoutStore {
  private readonly root: string
  private readonly cache = new Map<string, LayoutDocDTO>()

  constructor(dataDir: string) {
    if (typeof dataDir !== 'string' || dataDir.length === 0) throw new Error('dsh-mapper: config.dataDir must be a non-empty path')
    this.root = join(dataDir, 'layout')
  }

  /** Workspace ids come from the registry (uuids) or our cwd buckets
   * (`cwd:/path`); keep the file name inside the layout dir. */
  private fileFor(workspaceId: string): string | null {
    if (typeof workspaceId !== 'string' || workspaceId.length === 0 || workspaceId.length > 200) return null
    const safe = workspaceId.replace(/[^A-Za-z0-9._-]/g, '_')
    if (safe === '.' || safe === '..') return null
    return join(this.root, `${safe}.json`)
  }

  async get(workspaceId: string): Promise<LayoutDocDTO | null> {
    const cached = this.cache.get(workspaceId)
    if (cached !== undefined) return cached
    const file = this.fileFor(workspaceId)
    if (file === null) return null
    let doc: LayoutDocDTO
    try {
      const parsed = JSON.parse(await readFile(file, 'utf8'))
      const lanes: Record<string, { dx: number; dy: number }> = {}
      if (parsed && typeof parsed === 'object' && parsed.lanes && typeof parsed.lanes === 'object') {
        for (const [sessionId, offset] of Object.entries(parsed.lanes)) {
          const dx = Number((offset as any)?.dx)
          const dy = Number((offset as any)?.dy)
          if (typeof sessionId === 'string' && sessionId.length <= 200 && Number.isFinite(dx) && Number.isFinite(dy) && Object.keys(lanes).length < MAX_LANES) {
            lanes[sessionId.slice(0, 200)] = { dx: Math.round(dx), dy: Math.round(dy) }
          }
        }
      }
      doc = { workspaceId, lanes, updatedAt: typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : undefined }
    } catch {
      return null
    }
    this.cache.set(workspaceId, doc)
    return doc
  }

  async put(workspaceId: string, lanes: Record<string, { dx: number; dy: number }>): Promise<LayoutDocDTO> {
    const file = this.fileFor(workspaceId)
    if (file === null) throw new Error('非法工作区 id')
    const clean: Record<string, { dx: number; dy: number }> = {}
    for (const [sessionId, offset] of Object.entries(lanes ?? {})) {
      const dx = Number(offset?.dx)
      const dy = Number(offset?.dy)
      if (typeof sessionId === 'string' && sessionId.length <= 200 && Number.isFinite(dx) && Number.isFinite(dy) && Object.keys(clean).length < MAX_LANES) {
        clean[sessionId.slice(0, 200)] = { dx: Math.round(dx), dy: Math.round(dy) }
      }
    }
    const doc: LayoutDocDTO = { workspaceId, lanes: clean, updatedAt: new Date().toISOString() }
    await mkdir(dirname(file), { recursive: true })
    const tmp = `${file}.${process.pid}.tmp`
    await writeFile(tmp, `${JSON.stringify(doc)}\n`, 'utf8')
    await rename(tmp, file)
    this.cache.set(workspaceId, doc)
    return doc
  }
}
