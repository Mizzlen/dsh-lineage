// Scoped styles for the map overlay. Light values are defaults; dark mode
// overrides key off the web client's body[data-ds-dark-theme] signal.
export const MAP_STYLES = `
.dshm-overlay { position: fixed; inset: 0; z-index: 60; background: #f5f7fa; user-select: none; -webkit-user-select: none; }
.dshm-reader, .dshm-followup { user-select: text; -webkit-user-select: text; }
body[data-ds-dark-theme] .dshm-overlay { background: #16181d; }
.dshm-canvas { position: absolute; inset: 0; overflow: hidden; cursor: grab; }
.dshm-canvas.is-panning { cursor: grabbing; }
/* No standing will-change on the layer: it freezes Chromium's raster scale,
   so zoomed-in frames just upsample the scale-1 texture (blurry). Repaint at
   the current scale keeps text/edges vector-crisp; promotion is re-enabled
   only while panning, where translation never changes the raster scale. */
.dshm-layer { position: absolute; transform-origin: 0 0; }
.dshm-canvas.is-panning .dshm-layer { will-change: transform; }
.dshm-edges { position: absolute; overflow: visible; pointer-events: none; }
.dshm-edge { fill: none; stroke: #94a3b8; stroke-width: 1.5; }
.dshm-group { position: absolute; }
.dshm-group-label {
  position: absolute; left: 0; right: 0; height: 26px; line-height: 26px;
  font: 600 12px/26px Inter, system-ui, sans-serif; color: #475569;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
body[data-ds-dark-theme] .dshm-group-label { color: #94a3b8; }
.dshm-lane { position: absolute; }
.dshm-session-title {
  height: 30px; line-height: 30px; margin-bottom: 8px; padding: 0 10px;
  border-radius: 8px; background: #e2e8f0; color: #1e293b;
  font: 600 12px/30px Inter, system-ui, sans-serif;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
body[data-ds-dark-theme] .dshm-session-title { background: #262b33; color: #e2e8f0; }
.dshm-card {
  box-sizing: border-box; width: 300px; border: 1px solid #d7dee8; border-radius: 10px;
  background: #ffffff; padding: 8px 10px; margin-bottom: 18px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  font: 400 12px/1.5 Inter, system-ui, sans-serif; color: #334155;
}
body[data-ds-dark-theme] .dshm-card { background: #20242c; border-color: #343b46; color: #cbd5e1; }
.dshm-card.is-error { border-color: #f0a5a5; }
.dshm-q {
  margin: 0 0 6px; font-weight: 600; color: #0f172a;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
body[data-ds-dark-theme] .dshm-q { color: #f1f5f9; }
.dshm-a {
  margin: 0; color: #64748b;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
body[data-ds-dark-theme] .dshm-a { color: #94a3b8; }
.dshm-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.dshm-chip {
  border-radius: 999px; padding: 1px 8px; font-size: 10px; font-weight: 600;
  background: #eef2f7; color: #475569;
}
body[data-ds-dark-theme] .dshm-chip { background: #2a303a; color: #94a3b8; }
.dshm-chip.is-fail { background: #fdeaea; color: #b42323; }
body[data-ds-dark-theme] .dshm-chip.is-fail { background: #3a2626; color: #e0a0a0; }
.dshm-badge {
  float: right; border-radius: 999px; padding: 1px 8px; font-size: 10px; font-weight: 700;
  background: #e2e8f0; color: #475569;
}
.dshm-badge.is-running { background: #dbeafe; color: #1d4ed8; }
.dshm-badge.is-error { background: #fdeaea; color: #b42323; }
.dshm-badge.is-cancelled { background: #fef3c7; color: #92400e; }
body[data-ds-dark-theme] .dshm-badge { background: #2a303a; color: #94a3b8; }
body[data-ds-dark-theme] .dshm-badge.is-running { background: #1e3a5f; color: #93c5fd; }
body[data-ds-dark-theme] .dshm-badge.is-error { background: #3a2626; color: #e0a0a0; }
.dshm-loading { color: #94a3b8; font-style: italic; }
.dshm-topbar {
  position: absolute; top: 12px; left: 16px; right: 16px; display: flex; gap: 8px;
  align-items: center; pointer-events: none;
}
.dshm-topbar > * { pointer-events: auto; }
.dshm-btn {
  height: 30px; border: 1px solid #d1d5db; border-radius: 8px; background: rgba(255,255,255,.95);
  padding: 0 12px; font: 600 12px Inter, system-ui, sans-serif; color: #111827; cursor: pointer;
}
body[data-ds-dark-theme] .dshm-btn { background: #262b33; border-color: #343b46; color: #e5e7eb; }
.dshm-hint { font: 400 11px Inter, system-ui, sans-serif; color: #94a3b8; }
.dshm-toast {
  position: absolute; top: 52px; right: 16px; max-width: 420px; padding: 8px 14px;
  border-radius: 8px; background: #dcfce7; color: #14532d; font: 500 12px Inter, system-ui, sans-serif;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.15); z-index: 5;
}
.dshm-toast.is-error { background: #fdeaea; color: #b42323; }
body[data-ds-dark-theme] .dshm-toast { background: #1d3325; color: #bbf7d0; }
body[data-ds-dark-theme] .dshm-toast.is-error { background: #3a2626; color: #e0a0a0; }
.dshm-lane.is-sub { opacity: 0.75; }
.dshm-session-title.is-grabbable { cursor: grab; }
.dshm-session-title.is-grabbable:active { cursor: grabbing; }
.dshm-lane-actions { display: flex; gap: 4px; margin: -4px 0 6px; }
.dshm-lane-actions button {
  height: 22px; border: 1px solid #d7dee8; border-radius: 6px; background: #f8fafc;
  padding: 0 8px; font: 600 10px Inter, system-ui, sans-serif; color: #475569; cursor: pointer;
}
.dshm-lane-actions button:hover { background: #eef2f7; }
body[data-ds-dark-theme] .dshm-lane-actions button { background: #262b33; border-color: #343b46; color: #94a3b8; }
body[data-ds-dark-theme] .dshm-lane-actions button:hover { background: #303641; }
.dshm-chip.is-warn { background: #fef3c7; color: #92400e; }
body[data-ds-dark-theme] .dshm-chip.is-warn { background: #3a3222; color: #fcd34d; }
.dshm-chip.is-branch { border: 0; }
.dshm-chip.is-branch:hover { background: #e0e7ff; color: #3730a3; }
body[data-ds-dark-theme] .dshm-chip.is-branch:hover { background: #26304a; color: #a5b4fc; }
.dshm-q.is-clickable { cursor: pointer; }
.dshm-followup { margin: -2px 0 8px; }
.dshm-followup textarea {
  box-sizing: border-box; width: 100%; min-height: 56px; resize: vertical;
  border: 1px solid #94a3b8; border-radius: 8px; padding: 6px 8px;
  font: 400 12px/1.5 Inter, system-ui, sans-serif; background: #ffffff; color: #0f172a;
}
body[data-ds-dark-theme] .dshm-followup textarea { background: #20242c; color: #e2e8f0; border-color: #475569; }
.dshm-followup-bar { display: flex; gap: 6px; margin-top: 4px; }
.dshm-followup-bar .dshm-btn { height: 24px; padding: 0 10px; font-size: 11px; }
.dshm-chip.is-expand { cursor: pointer; }
.dshm-chip.is-expand:hover { background: #dbeafe; color: #1d4ed8; }
body[data-ds-dark-theme] .dshm-chip.is-expand:hover { background: #1e3a5f; color: #93c5fd; }
.dshm-lane.is-pending .dshm-card { border-style: dashed; opacity: 0.85; }
.dshm-lane.is-pending .dshm-session-title { background: repeating-linear-gradient(45deg, #e2e8f0, #e2e8f0 6px, #edf1f6 6px, #edf1f6 12px); }
body[data-ds-dark-theme] .dshm-lane.is-pending .dshm-session-title { background: repeating-linear-gradient(45deg, #262b33, #262b33 6px, #2d333d 6px, #2d333d 12px); }

/* macOS traffic lights: keep the topbar clear of the window controls. */
.dshm-mac .dshm-topbar { left: 88px; }

/* Expanded-reading float (v0.0.4): the clicked card rises to the foreground
   center over a dimmed backdrop. The float is a sibling of the canvas element
   (not a descendant), so wheel events over it scroll the body and never reach
   the canvas's wheel-zoom listener. */
.dshm-reader-scrim {
  position: absolute; inset: 0; background: rgba(15, 23, 42, 0.42);
  animation: dshm-scrim-in 200ms ease; z-index: 4;
}
body[data-ds-dark-theme] .dshm-reader-scrim { background: rgba(2, 4, 10, 0.55); }
@keyframes dshm-scrim-in { from { opacity: 0; } to { opacity: 1; } }
.dshm-reader {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  width: min(720px, 88vw); max-height: 78vh;
  background: #ffffff; border: 1px solid #d7dee8; border-radius: 14px;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.30), 0 6px 18px rgba(15, 23, 42, 0.18);
  display: flex; flex-direction: column; overflow: hidden; z-index: 5;
  will-change: transform;
}
body[data-ds-dark-theme] .dshm-reader { background: #20242c; border-color: #343b46; box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55); }
.dshm-reader-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 12px 16px; border-bottom: 1px solid #e2e8f0; flex: none;
}
body[data-ds-dark-theme] .dshm-reader-bar { border-bottom-color: #343b46; }
.dshm-reader-title { font: 600 13px Inter, system-ui, sans-serif; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
body[data-ds-dark-theme] .dshm-reader-title { color: #f1f5f9; }
.dshm-reader-body { padding: 16px 20px 32px; overflow-y: auto; overscroll-behavior: contain; }
.dshm-reader-q { font: 600 14px/1.6 Inter, system-ui, sans-serif; color: #0f172a; margin-bottom: 14px; }
body[data-ds-dark-theme] .dshm-reader-q { color: #f1f5f9; }
.dshm-reader-a { font: 400 13px/1.75 Inter, system-ui, sans-serif; color: #1e293b; }
body[data-ds-dark-theme] .dshm-reader-a { color: #cbd5e1; }

.dshm-md .dshm-p { margin: 0 0 10px; white-space: pre-wrap; }
.dshm-md .dshm-p:last-child { margin-bottom: 0; }
.dshm-md .dshm-h { margin: 18px 0 8px; font-weight: 700; line-height: 1.4; color: inherit; }
.dshm-md .dshm-h1 { font-size: 20px; } .dshm-md .dshm-h2 { font-size: 17px; }
.dshm-md .dshm-h3 { font-size: 15px; } .dshm-md .dshm-h4, .dshm-md .dshm-h5, .dshm-md .dshm-h6 { font-size: 14px; }
.dshm-md .dshm-list { margin: 0 0 10px; padding-left: 22px; }
.dshm-md .dshm-list li { margin: 3px 0; }
.dshm-md .dshm-list ul, .dshm-md .dshm-list ol { margin: 3px 0 0; }
.dshm-md .dshm-quote { margin: 0 0 10px; padding: 6px 12px; border-left: 3px solid #cbd5e1; color: #64748b; }
body[data-ds-dark-theme] .dshm-md .dshm-quote { border-left-color: #475569; color: #94a3b8; }
.dshm-md .dshm-hr { border: 0; border-top: 1px solid #e2e8f0; margin: 14px 0; }
body[data-ds-dark-theme] .dshm-md .dshm-hr { border-top-color: #343b46; }
.dshm-md .dshm-pre {
  background: #0f172a; color: #e2e8f0; border-radius: 8px; padding: 10px 12px;
  overflow-x: auto; font: 400 12px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; margin: 0 0 10px;
  white-space: pre-wrap; word-break: break-word;
}
body[data-ds-dark-theme] .dshm-md .dshm-pre { background: #14161b; }
.dshm-md .dshm-mcode {
  background: #eef2f7; color: #b42323; border-radius: 4px; padding: 1px 5px;
  font: 400 12px ui-monospace, SFMono-Regular, Menlo, monospace;
}
body[data-ds-dark-theme] .dshm-md .dshm-mcode { background: #2a303a; color: #f0a5a5; }
.dshm-md .dshm-table { border-collapse: collapse; margin: 0 0 12px; width: 100%; font-size: 12px; }
.dshm-md .dshm-table th, .dshm-md .dshm-table td { border: 1px solid #d7dee8; padding: 5px 8px; text-align: left; vertical-align: top; }
.dshm-md .dshm-table th { background: #f1f5f9; font-weight: 600; }
body[data-ds-dark-theme] .dshm-md .dshm-table th, body[data-ds-dark-theme] .dshm-md .dshm-table td { border-color: #343b46; }
body[data-ds-dark-theme] .dshm-md .dshm-table th { background: #262b33; }
.dshm-md a { color: #2563eb; }
`
