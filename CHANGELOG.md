# Changelog

All notable changes are documented here. Dates are 2026-10-04/05 (single development sprint).

## v0.1.0 — initial public release

The first version prepared for the dsh.pub community catalog.

A visual conversation map plugin for DeepSeek Harness: one lineage tree — a root session and everything branched from it — as a single navigable canvas. Read-only over DSH session logs; the plugin persists nothing but view metadata.

### Highlights

- **Lineage map (default view)**: the whole tree from the root ancestor — ancestor chain, ancestors' other branches, all descendants — with **no workspace separation inside the tree** (lineage follows `parentSessionId`; a fork child stuck in a cwd bucket is still the same tree).
- **Workspace view (drill-up)**: the flat session slice of one workspace bucket, mirroring how DSH lists sessions.
- **Turn-anchored fork edges**: fork edges leave from the exact turn card they were cut at (circular `>` button on the card's right edge); the branch cut is the turn's `turn/end`, so a branch child inherits the complete turn — question, answer and tools — as its context.
- **Lazy branches**: `>` records a stub (dashed ◇ lane) without creating a session; the trailing **ask card** — the whole card is one input — forks the session and delivers the first message on Enter. Stubs are pure view metadata.
- **Ask card on every lane**: message cards carry no follow-up button; asking about a middle turn is expressed as a branch.
- **Expanded reading**: double click a card and it rises to the foreground center over a dimmed backdrop (self-built markdown renderer); wheel scrolls the float only.
- **Lane title three-in-one**: single click opens the session, double click renames it, drag moves the lane.
- **Reliable jumps**: sidebar-row bridge with collapsed-group expansion, bilingual (en/zh) row-chrome stripping, title-leaf exact matching (immune to digit-ending titles glued with timestamps), a cancellation token (no queued jumps firing after the map closes) and `__dshmJumpDebug` failure evidence.
- Vector-crisp zoom, drag without text selection, subagent toggle, macOS traffic-light clearance, per-workspace lane-offset persistence.

### Highlights (简体中文)

- **血缘图（默认视角）**：根会话的整棵树即一张地图，树内不做任何工作区隔断；工作区视图为上钻的扁平切片。
- **轮次锚定的分支边**：连线从切点卡片的「>」圆钮引出；切点在该轮 `turn/end`，分支子会话继承"问题+回答+工具"的完整一轮。
- **懒分支与追问卡**：「>」只记存根（◇ 虚线泳道）；泳道尾部常驻追问卡（整卡即输入框），第一次追问即物化真会话。
- **展开阅读**：双击卡片上浮至前景中心，背景压暗；浮层内滚轮只滚正文。
- **可靠跳转**：双语行文案剥离 + 标题叶子精确匹配 + 取消令牌 + `__dshmJumpDebug` 失败取证。
- 矢量清晰缩放、拖拽不选中文本、subagent 开关、macOS 红绿灯避让、泳道偏移按工作区持久化。

### Compatibility

- DeepSeek Harness **0.2.0-rc.2**, `web` profile; Node.js >= 22.19.0.
- 46 unit tests; CI runs build + tests + artifact-contract checks and a web-profile activation smoke against the latest published DSH release.

## v0.0.x (development iterations, 2026-10-04)

- v0.0.1–v0.0.3: map canvas, lanes/cards/edges, jump bridge, follow-up, lazy branches, expanded-reading drawer, in-map rename.
- v0.0.4: floating expanded-reading card, wheel isolation, turn-anchored edges, crisp zoom (raster-scale fix), panning without text selection.
- v0.0.5–v0.0.7: unified title/card interaction model, trailing ask card, bilingual row matching, lineage-tree scope, fork-at-turn-end context inheritance, jump diagnostics and cancellation.
