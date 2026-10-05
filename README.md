# dsh-mapper

[README 中文](README.zh-CN.md)

A visual conversation map plugin for DeepSeek Harness: sessions, follow-ups and forks of one workspace as a single navigable canvas.

**DSH session logs remain the only source of truth.** The plugin reads them on demand through `ctx.sessionQuery` and persists nothing but view metadata (lane drag offsets). It never touches prompts, tool schemas, provider routing, or KV-cache prefixes.

## Features (M2/M3)

- **Read-only map**: lane = session (title + running badge), card = one turn (question, answer snippet, tool chips, failure count, cancelled/error badges, pending-approval chips), SVG curves = fork lineage edges (from `SessionHeader.parentSession`).
- **Jump**: click a card's question to close the map, open the conversation, and scroll to that exact turn (sidebar-row + chat-anchor bridge with explicit degradation).
- **Follow-up**: inline input on a lane, sent through the session binding's `prompt(…, 'queue')`.
- **Fork**: per lane (latest completed turn) or per card (exact `atSeq` cut).
- **Layout persistence**: drag lane headers; offsets are stored per workspace under `$DSH_HOME/dsh-mapper/layout/` (view metadata only).
- **Subagent toggle**, live running status, viewport culling, wheel zoom / shift-alt pan / drag pan / double-click fit.

## Compatibility

- DeepSeek Harness **0.2.0-rc.2**, `web` profile only (contract-verified against the installed release; see `docs/contract-notes.md`).
- Node.js >= 22.19.0.

## Install / verify

```sh
dsh plugin --profile web add ./
dsh --profile web --dump-config
dsh --profile web
```

Open any session → the 「会话地图」 header button → the map overlay. Host API: `GET /mapper/api/graph`, `GET /mapper/api/sessions/:id/turns`, `GET|PUT /mapper/api/layout/:workspaceId`, `GET /mapper/api/health`.

## Configuration (cordis.patch.yml)

| Field | Default | Meaning |
|---|---|---|
| `dataDir` | `$DSH_HOME/dsh-mapper` | Lane-offset storage directory (view metadata only) |
| `trustedHosts` | `[]` | Extra accepted Host names for proxied deployments (localhost always allowed) |

## Disable / uninstall

`dsh plugin --profile web remove dsh-mapper`. Only `$DSH_HOME/dsh-mapper/` (offset data) remains; session data is untouched.

## Known limits

- Jump relies on sidebar-row title matching and the chat DOM anchor prefix (`data-chat-anchor-key`) — a version-sensitive bridge, centralized in `src/client/glue.ts` with explicit degradation.
- Follow-up requires the session to be materialized in the client (an existing binding); otherwise the map asks you to open it once natively.
- Not implemented: minimap, synapse data import, settings card (configuration stays in the patch file).

## License

MIT — see [LICENSE](LICENSE). Ideas inspired by dsh-synapse (MIT) © liangmianya; an independent implementation sharing no code.
