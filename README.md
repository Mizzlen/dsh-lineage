# dsh-mapper

[README 中文](README.zh-CN.md)

A visual conversation map plugin for DeepSeek Harness: sessions, follow-ups and forks of one workspace as a single navigable canvas.

**DSH session logs remain the only source of truth.** The plugin reads them on demand through `ctx.sessionQuery` and persists nothing but view metadata (lane drag offsets). It never touches prompts, tool schemas, provider routing, or KV-cache prefixes.

## Features (v0.0.6)

- **Session-centric scope**: opening the map from a session centers on it and shows its lineage neighborhood (ancestor chain + fork descendants), strictly inside its workspace. One drill-up — "expand to workspace map" — and the workspace is the ceiling: no aggregation above it.
- **Lane title, three-in-one**: single click opens the conversation, double click renames it (stub lanes rename the branch), drag moves the lane.
- **Ask card**: every lane's card queue **ends with a trailing ask card — the whole card is one input** (Enter sends, Shift+Enter breaks a line, grows with content); message cards carry no follow-up button, and **"asking about a middle turn" is expressed as a branch via the card's ">"**. A stub lane is just its ask card: the first send forks the real session and delivers the message.
- **Card interactions**: single click on the question jumps to that turn; **double click on the card background** opens expanded reading — the card rises to the foreground center over a dimmed backdrop (same markdown spec as the native page, via `src/client/markdown.ts`), wheel scrolls the float only; the **circular ">" on the card's right edge is "branch from this turn"** — the fork edge leaves from that button and lands on the cut's card.
- **Turn-anchored fork edges**: stubs record their cut at the branch turn's `turn/end` — the child inherits the WHOLE turn (question + answer + tools), matching the edge the map draws from that card; materialized forks resolve the cut from the child log's inherited prefix length (`inheritedEventCount`). Both edge kinds leave from the cut card's ">" button, never the lane header.
- **Lazy branches**: ">" only records a stub (dashed ◇ lane; ✕ in the title bar deletes, double click renames). Stubs are pure view metadata under `$DSH_HOME/dsh-mapper/branches/` and never touch any DSH session.
- **Read-only map**: lane = session (title + running badge), card = one turn (question, answer snippet, tool chips, failure count, cancelled/error badges, pending-approval chips), SVG curves = fork lineage edges (from `SessionHeader.parentSession`).
- **Reliable jumps**: the sidebar-row bridge expands collapsed workspace groups, handles truncated lists and virtualized rows, and strips the status/time chrome glued onto row labels (including the active row's "Completed…now") before exact-matching, distinguishing same-named forks; failures degrade explicitly.
- **Layout persistence**: drag lane headers; offsets are stored per workspace under `$DSH_HOME/dsh-mapper/layout/` (view metadata only).
- **Subagent toggle**, live running status, wheel zoom / shift-alt pan / drag pan / double-click-on-empty reset; panning never sweeps text selection and zoom stays vector-crisp.

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
