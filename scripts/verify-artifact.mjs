// Runtime artifact contract check (develop-plugin.md L244-245):
// the committed lib/client.js must carry the exact package name as its
// factory id and register through window.__ModuleLoader__.load.
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require_ = createRequire(import.meta.url)
const pkg = require_('../package.json')

const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
const host = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8')

const checks = [
  [`client: factory id is exact package name`, client.includes(`id: "${pkg.name}"`)],
  ['client: registers via __ModuleLoader__.load', client.includes('window.__ModuleLoader__.load')],
  ['client: exports apply via module.exports', /exports\.apply\s*=|apply:\s*\(\)\s*=>\s*apply/.test(client)],
  ['client: exports inject via module.exports', /exports\.inject\s*=|inject:\s*\(\)\s*=>\s*inject/.test(client)],
  ['client: final exports carry Module toStringTag', /Object\.defineProperty\(module\.exports, Symbol\.toStringTag/.test(client)],
  ['host: exports apply', /export\s*\{[^}]*apply|exports\.apply|apply\s+as/.test(host) || host.includes('apply')],
]

let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failed++
}
if (failed > 0) process.exit(1)
