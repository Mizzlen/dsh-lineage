// Pending branch stubs (v0.0.3 lazy fork): 「分支」 records intent only; the
// real DSH session is created when the first follow-up is sent. Stubs are
// view metadata per workspace, one small JSON file each. Cache and files are
// keyed by the same escaped workspace id, so every path touches one entry.
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'

export interface BranchStub {
  id: string
  sourceSessionId: string
  atSeq: number | null
  title: string
  workspaceId: string
  createdAt: string
}

interface BranchDoc {
  branches: BranchStub[]
}

const MAX_BRANCHES_PER_WORKSPACE = 200
const MAX_TITLE = 120

export class BranchStore {
  private readonly root: string
  private readonly cache = new Map<string, BranchDoc>()

  constructor(dataDir: string) {
    if (typeof dataDir !== 'string' || dataDir.length === 0) throw new Error('dsh-mapper: config.dataDir must be a non-empty path')
    this.root = join(dataDir, 'branches')
  }

  private keyFor(workspaceId: string): string {
    return workspaceId.replace(/[^A-Za-z0-9._-]/g, '_')
  }

  private fileFor(key: string): string {
    return join(this.root, `${key}.json`)
  }

  private empty(): BranchDoc {
    return { branches: [] }
  }

  async all(): Promise<BranchStub[]> {
    let files: string[] = []
    try {
      await mkdir(this.root, { recursive: true })
      files = (await readdir(this.root)).filter(f => f.endsWith('.json'))
    } catch {
      return []
    }
    const all: BranchStub[] = []
    for (const file of files) {
      const key = file.replace(/\.json$/, '')
      let doc = this.cache.get(key)
      if (doc === undefined) {
        try {
          const parsed = JSON.parse(await readFile(this.fileFor(key), 'utf8'))
          doc = { branches: sanitizeBranches(parsed?.branches) }
        } catch {
          doc = { branches: [] }
        }
        this.cache.set(key, doc)
      }
      all.push(...doc.branches)
    }
    return all
  }

  async create(input: { sourceSessionId: string; atSeq: number | null; title?: string; workspaceId: string }): Promise<BranchStub> {
    if (!/^[A-Za-z0-9_-]+$/.test(input.sourceSessionId)) throw new Error('非法来源会话 id')
    const key = this.keyFor(input.workspaceId)
    const doc = (await this.loadByKey(key, input.workspaceId))
    if (doc.branches.length >= MAX_BRANCHES_PER_WORKSPACE) throw new Error('分支存根过多')
    const stub: BranchStub = {
      id: `branch-${randomUUID()}`,
      sourceSessionId: input.sourceSessionId,
      atSeq: Number.isSafeInteger(input.atSeq) ? (input.atSeq as number) : null,
      title: typeof input.title === 'string' && input.title.trim() !== '' ? input.title.trim().slice(0, MAX_TITLE) : '新分支',
      workspaceId: input.workspaceId,
      createdAt: new Date().toISOString(),
    }
    doc.branches.push(stub)
    await this.persist(key, doc)
    return stub
  }

  async rename(id: string, title: string): Promise<BranchStub> {
    if (typeof title !== 'string' || title.trim() === '') throw new Error('标题不能为空')
    for (const [key, doc] of this.cache) {
      const stub = doc.branches.find(b => b.id === id)
      if (stub !== undefined) {
        stub.title = title.trim().slice(0, MAX_TITLE)
        await this.persist(key, doc)
        return stub
      }
    }
    throw new Error('分支不存在')
  }

  async remove(id: string): Promise<boolean> {
    for (const [key, doc] of this.cache) {
      const before = doc.branches.length
      doc.branches = doc.branches.filter(b => b.id !== id)
      if (doc.branches.length !== before) {
        await this.persist(key, doc)
        return true
      }
    }
    return false
  }

  private async loadByKey(key: string, workspaceId: string): Promise<BranchDoc> {
    let doc = this.cache.get(key)
    if (doc === undefined) {
      try {
        const parsed = JSON.parse(await readFile(this.fileFor(key), 'utf8'))
        doc = { branches: sanitizeBranches(parsed?.branches) }
      } catch {
        doc = this.empty()
      }
      this.cache.set(key, doc)
    }
    return doc
  }

  private async persist(key: string, doc: BranchDoc): Promise<void> {
    const file = this.fileFor(key)
    await mkdir(dirname(file), { recursive: true })
    const tmp = `${file}.${process.pid}.tmp`
    await writeFile(tmp, `${JSON.stringify(doc)}\n`, 'utf8')
    await rename(tmp, file)
  }
}

function sanitizeBranches(value: unknown): BranchStub[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((b: any) => typeof b?.id === 'string' && typeof b?.sourceSessionId === 'string')
    .slice(0, MAX_BRANCHES_PER_WORKSPACE)
    .map((b: any) => ({
      id: String(b.id),
      sourceSessionId: String(b.sourceSessionId),
      atSeq: Number.isSafeInteger(b.atSeq) ? b.atSeq : null,
      title: typeof b.title === 'string' ? b.title.slice(0, MAX_TITLE) : '新分支',
      workspaceId: typeof b.workspaceId === 'string' ? b.workspaceId : '',
      createdAt: typeof b.createdAt === 'string' ? b.createdAt : new Date().toISOString(),
    }))
}
