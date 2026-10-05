import { build } from 'esbuild'
import { mkdir, writeFile } from 'node:fs/promises'

const CLIENT_ID = 'dsh-mapper'
// Loader-resolved externals: react* and all dsh client packages come from the
// page's module table via the factory `require`, never from our bundle.
const externals = ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/*']

// Host face: single ESM file for the Cordis loader.
await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: 'lib/index.js',
  logLevel: 'info',
})

// Client face: CJS bundle wrapped into the Web loader's lazy factory,
// replicating the unpublished `clientBundle()` tsdown preset (see
// docs/contract-notes.md §e for the contract extracted from 0.2.0-rc.2).
const client = await build({
  entryPoints: ['src/client/index.tsx'],
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  target: 'es2022',
  jsx: 'automatic',
  write: false,
  external: externals,
  logLevel: 'info',
})

const js = client.outputFiles[0].text
const wrapped = `window.__ModuleLoader__.load({
\tid: ${JSON.stringify(CLIENT_ID)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
${js}
\t\t// After the bundle: esbuild replaces module.exports (__toCommonJS),
\t\t// so the Module marker lands on the final object, matching the
\t\t// official clientBundle() output shape.
\t\tObject.defineProperty(module.exports, Symbol.toStringTag, { value: "Module" });
\t\treturn module.exports;
\t}
});
`

if (!wrapped.includes(`id: "${CLIENT_ID}"`) || !wrapped.includes('window.__ModuleLoader__.load')) {
  throw new Error('client bundle wrapper assertion failed')
}

await mkdir('lib', { recursive: true })
await writeFile('lib/client.js', wrapped)
console.log(`lib/client.js: ${(wrapped.length / 1024).toFixed(1)} KiB, factory id "${CLIENT_ID}"`)
