// Scoped styles for the map overlay. Light values are defaults; dark mode
// overrides key off the web client's body[data-ds-dark-theme] signal.
export const MAP_STYLES = `
.dshm-overlay { position: fixed; inset: 0; z-index: 60; background: #f5f7fa; }
body[data-ds-dark-theme] .dshm-overlay { background: #16181d; }
.dshm-canvas { position: absolute; inset: 0; overflow: hidden; cursor: grab; }
.dshm-canvas.is-panning { cursor: grabbing; }
.dshm-layer { position: absolute; transform-origin: 0 0; will-change: transform; }
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
`
