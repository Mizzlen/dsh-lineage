# dsh-mapper

[README 中文](README.zh-CN.md)

A visual conversation map plugin for DeepSeek Harness: sessions, follow-ups and forks of one workspace as a single navigable canvas.

**DSH session logs remain the only source of truth.** The plugin reads them on demand through `ctx.sessionQuery` and persists nothing but view metadata (lane drag offsets). It never touches prompts, tool schemas, provider routing, or KV-cache prefixes.

## Features (v0.1.0)

- **Lineage map (default)**: a tree rooted at a root session is ONE map — opening it from any member shows the WHOLE tree from the root: the ancestor chain, ancestors' other branches, and all descendants. Lineage follows `parentSessionId` with **no workspace separation inside the tree** (a fork child stuck in a cwd bucket is still the same tree); a branch added on any lane appears in the same map immediately, and any ancestor ↔ any descendant pair is one click apart.
- **Workspace view (drill-up)**: one click expands to the flat session slice of a workspace bucket — the tier that mirrors how DSH itself lists sessions.
- **Lane title, three-in-one**: single click opens the conversation, double click renames it (stub lanes rename the branch), drag moves the lane.
- **Ask card**: every lane's card queue **ends with a trailing ask card — the whole card is one input** (Enter sends, Shift+Enter breaks a line, grows with content); message cards carry no follow-up button, and **"asking about a middle turn" is expressed as a branch via the card's ">"**. A stub lane is just its ask card: the first send forks the real session and delivers the message.
- **Card interactions**: single click on the question jumps to that turn; **double click on the card background** opens expanded reading — the card rises to the foreground center over a dimmed backdrop (same markdown spec as the native page, via `src/client/markdown.ts`), wheel scrolls the float only; the **circular ">" on the card's right edge is "branch from this turn"** — the fork edge leaves from that button and lands on the cut's card.
- **Context inheritance follows the map's edges**: the branch cut is the branch turn's `turn/end` — the child inherits the WHOLE turn (question + answer + tools) and the ask card's text lands as the next user message; materialized forks resolve the cut from the child log's inherited prefix length (`inheritedEventCount`). Both edge kinds leave from the cut card's ">" button, never the lane header.
- **Jump lifecycle**: the row bridge takes a cancellation token — closing the map or starting a new jump cancels in-flight bridge walks (retries, scrolling, row clicks), so nothing fires late; failures dump full row-label evidence via `__dshmJumpDebug`.
- **Lazy branches**: ">" only records a stub (dashed ◇ lane; ✕ in the title bar deletes, double click renames). Stubs are pure view metadata under `$DSH_HOME/dsh-mapper/branches/` and never touch any DSH session.
- **Read-only map**: lane = session (title + running badge), card = one turn (question, answer snippet, tool chips, failure count, cancelled/error badges, pending-approval chips), SVG curves = fork lineage edges (from `SessionHeader.parentSession`).
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

- Jump relies on the native sidebar's DOM structure (the row's title leaf, the chat anchor prefix `data-chat-anchor-key`) — a version-sensitive bridge, centralized in `src/client/glue.ts`. Matching runs in three passes (title-leaf exact → safe composed-strip → aggressive strip) and on failure dumps full evidence to the console as `__dshmJumpDebug` before degrading explicitly.
- Branching from a turn that is still running has no `turn/end` yet: the cut falls back to the turn's opening question (the unfinished answer is not inherited).
- Not implemented: minimap, synapse data import, settings card (configuration stays in the patch file).

## Release status

Prepared per the [dsh.pub plugin development and catalog-admission guide](https://dsh.pub/develop-plugin.md): the repository root is an independently installable package with committed runtime artifacts, a declared safe `dsh.bundle.patch`, and CI covering build, tests, artifact-contract checks and a web-profile activation smoke. dsh.pub listing happens through its automated gates and a submission Pull Request — **it implies no human review, security audit, compatibility certification, or official DeepSeek endorsement**.

## License

MIT — see [LICENSE](LICENSE). Ideas inspired by dsh-synapse (MIT) © liangmianya; an independent implementation sharing no code.
