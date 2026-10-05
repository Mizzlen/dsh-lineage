window.__ModuleLoader__.load({
	id: "dsh-lineage",
	factory: (require) => {
		var module = { exports: {} };
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react3 = require("react");

// src/client/observable.ts
function createSource(initial) {
  let value = initial;
  const listeners = /* @__PURE__ */ new Set();
  return {
    getSnapshot: () => value,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set: (next) => {
      if (Object.is(next, value)) return;
      value = next;
      for (const listener of listeners) listener();
    }
  };
}

// src/client/MapPanel.tsx
var import_react2 = require("react");

// src/shared/protocol.ts
function turnKey(sessionId, seq) {
  return `${sessionId}#${seq}`;
}

// src/client/scope.ts
function originWorkspaceId(graph, originSessionId) {
  if (originSessionId === null) return null;
  return graph.nodes.find((node) => node.sessionId === originSessionId)?.workspaceId ?? null;
}
function rootTree(graph, originSessionId) {
  const byId = new Map(graph.nodes.map((node) => [node.sessionId, node]));
  let root = byId.get(originSessionId);
  if (root === void 0) {
    let workspaceId = originWorkspaceId(graph, originSessionId);
    if (workspaceId === null) {
      const first = graph.workspaces.find((workspace) => graph.nodes.some((node) => node.workspaceId === workspace.workspaceId));
      workspaceId = first?.workspaceId ?? null;
    }
    return workspaceSlice(graph, workspaceId);
  }
  const walked = /* @__PURE__ */ new Set([root.sessionId]);
  while (root.parentSessionId !== null && byId.has(root.parentSessionId) && !walked.has(root.parentSessionId)) {
    walked.add(root.parentSessionId);
    root = byId.get(root.parentSessionId);
  }
  const childrenOf = /* @__PURE__ */ new Map();
  for (const node of graph.nodes) {
    if (node.parentSessionId !== null && byId.has(node.parentSessionId)) {
      const list = childrenOf.get(node.parentSessionId) ?? [];
      list.push(node.sessionId);
      childrenOf.set(node.parentSessionId, list);
    }
  }
  const keep = /* @__PURE__ */ new Set([root.sessionId]);
  const stack = [root.sessionId];
  while (stack.length > 0) {
    const id = stack.pop();
    for (const child of childrenOf.get(id) ?? []) {
      if (!keep.has(child)) {
        keep.add(child);
        stack.push(child);
      }
    }
  }
  const nodes = graph.nodes.filter((node) => keep.has(node.sessionId));
  return { ...graph, nodes, edges: graph.edges.filter((edge) => keep.has(edge.from) && keep.has(edge.to)) };
}
function workspaceSlice(graph, workspaceId) {
  const nodes = graph.nodes.filter((node) => node.workspaceId === workspaceId);
  const ids = new Set(nodes.map((node) => node.sessionId));
  return { ...graph, nodes, edges: graph.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to)) };
}
function scopedGraph(graph, scope, originSessionId) {
  if (originSessionId !== null && scope === "lineage") return rootTree(graph, originSessionId);
  let workspaceId = originWorkspaceId(graph, originSessionId);
  if (workspaceId === null) {
    const first = graph.workspaces.find((workspace) => graph.nodes.some((node) => node.workspaceId === workspace.workspaceId));
    workspaceId = first?.workspaceId ?? null;
  }
  return workspaceSlice(graph, workspaceId);
}
function forkAnchorY(list, cut, cardPos) {
  if (cut === null || cut === void 0 || list === void 0) return null;
  let best;
  for (const turn of list.turns) {
    if (turn.startSeq <= cut && (best === void 0 || turn.startSeq > best.startSeq)) best = turn;
  }
  if (best === void 0) return null;
  const card = cardPos[turnKey(list.sessionId, best.startSeq)];
  if (card === void 0) return null;
  return card.top + card.height / 2;
}

// src/client/markdown.ts
var import_react = require("react");
var keyCounter = 0;
var nextKey = () => `md${keyCounter += 1}`;
var INLINE_RULES = [
  { pattern: /`([^`]+)`/, render: (m) => (0, import_react.createElement)("code", { key: nextKey(), className: "dshm-mcode" }, m[1]) },
  { pattern: /\*\*([^*]+)\*\*/, render: (m) => (0, import_react.createElement)("strong", { key: nextKey() }, m[1]) },
  { pattern: /__([^_]+)__/, render: (m) => (0, import_react.createElement)("strong", { key: nextKey() }, m[1]) },
  { pattern: /(^|[^*])\*([^*\n]+)\*/, render: (m) => (0, import_react.createElement)(import_react.Fragment, { key: nextKey() }, m[1], (0, import_react.createElement)("em", { key: nextKey() + "e" }, m[2])) },
  { pattern: /~~([^~]+)~~/, render: (m) => (0, import_react.createElement)("del", { key: nextKey() }, m[1]) },
  { pattern: /\[([^\]]+)\]\(([^)\s]+)\)/, render: (m) => (0, import_react.createElement)("a", { key: nextKey(), href: m[2], target: "_blank", rel: "noreferrer noopener" }, m[1]) }
];
function renderInline(text) {
  const nodes = [];
  let rest = text;
  while (rest.length > 0) {
    let best = null;
    for (const rule of INLINE_RULES) {
      const match = rule.pattern.exec(rest);
      if (match !== null && (best === null || match.index < best.index)) {
        best = { index: match.index, match, render: rule.render };
      }
    }
    if (best === null) {
      nodes.push(rest);
      break;
    }
    if (best.index > 0) nodes.push(rest.slice(0, best.index));
    nodes.push(best.render(best.match));
    rest = rest.slice(best.index + best.match[0].length);
  }
  return nodes;
}
function splitRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}
var isTableDelimiter = (line) => /^\s*\|?[\s:-]*-[-\s:|]*\|?\s*$/.test(line) && line.includes("-");
function renderTable(lines, index) {
  const header = splitRow(lines[index]);
  const body = lines.slice(index + 2).map(splitRow);
  return (0, import_react.createElement)(
    "table",
    { key: nextKey(), className: "dshm-table" },
    (0, import_react.createElement)(
      "thead",
      { key: "h" },
      (0, import_react.createElement)("tr", { key: "r" }, header.map((cell, i) => (0, import_react.createElement)("th", { key: i }, renderInline(cell))))
    ),
    (0, import_react.createElement)(
      "tbody",
      { key: "b" },
      body.map((row, r) => (0, import_react.createElement)("tr", { key: r }, row.map((cell, c) => (0, import_react.createElement)("td", { key: c }, renderInline(cell)))))
    )
  );
}
function renderList(lines, start) {
  const ordered = /^\s*\d+[.)]\s/.test(lines[start]);
  const items = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") break;
    const isItem = ordered ? /^\s*\d+[.)]\s/.test(line) : /^\s*[-*+]\s/.test(line);
    if (!isItem && items.length > 0 && /^\s+\S/.test(line)) {
      items[items.length - 1].lines.push(line.trim());
      i += 1;
      continue;
    }
    if (!isItem) break;
    const indent = line.length - line.trimStart().length;
    items.push({ indent, lines: [line.replace(ordered ? /^\s*\d+[.)]\s/ : /^\s*[-*+]\s/, "").trim()] });
    i += 1;
  }
  const topLevel = items[0]?.indent ?? 0;
  const children = [];
  for (const item of items) {
    const nested = item.indent >= topLevel + 2;
    const target = nested && children.length > 0 ? children[children.length - 1] : null;
    const content = renderInline(item.lines.join(" "));
    if (target !== null && Array.isArray(target.props.children)) {
      target.props.children.push((0, import_react.createElement)("li", { key: nextKey() }, content));
    } else {
      children.push((0, import_react.createElement)("li", { key: nextKey() }, content));
    }
  }
  return { node: (0, import_react.createElement)(ordered ? "ol" : "ul", { key: nextKey(), className: "dshm-list" }, children), next: i };
}
function renderMarkdown(text) {
  keyCounter = 0;
  const lines = text.replaceAll("\r\n", "\n").split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = /^```(\w*)/.exec(line);
    if (fence !== null) {
      const lang = fence[1] || null;
      const code = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push((0, import_react.createElement)(
        "pre",
        { key: nextKey(), className: "dshm-pre", "data-lang": lang ?? void 0 },
        (0, import_react.createElement)("code", { key: "c" }, code.join("\n"))
      ));
      continue;
    }
    if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
      blocks.push((0, import_react.createElement)("hr", { key: nextKey(), className: "dshm-hr" }));
      i += 1;
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading !== null) {
      const level = heading[1].length;
      blocks.push((0, import_react.createElement)(`h${level}`, { key: nextKey(), className: `dshm-h dshm-h${level}` }, renderInline(heading[2])));
      i += 1;
      continue;
    }
    if (line.startsWith(">")) {
      const quote = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        quote.push(lines[i].replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push((0, import_react.createElement)("blockquote", { key: nextKey(), className: "dshm-quote" }, renderMarkdown(quote.join("\n"))));
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && isTableDelimiter(lines[i + 1]) && splitRow(line).length >= 2) {
      const table = [];
      while (i < lines.length && lines[i].includes("|")) {
        table.push(lines[i]);
        i += 1;
      }
      blocks.push(renderTable(table, 0));
      continue;
    }
    if (/^\s*[-*+]\s/.test(line) || /^\s*\d+[.)]\s/.test(line)) {
      const list = renderList(lines, i);
      blocks.push(list.node);
      i = list.next;
      continue;
    }
    if (line.trim() === "") {
      i += 1;
      continue;
    }
    const para = [];
    const isTableStart = (index) => lines[index].includes("|") && index + 1 < lines.length && isTableDelimiter(lines[index + 1]) && splitRow(lines[index]).length >= 2;
    while (i < lines.length && lines[i].trim() !== "" && !/^```/.test(lines[i]) && !/^(#{1,6})\s/.test(lines[i]) && !/^\s*[-*+]\s/.test(lines[i]) && !/^\s*\d+[.)]\s/.test(lines[i]) && !lines[i].startsWith(">") && !isTableStart(i) && !/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push((0, import_react.createElement)("p", { key: nextKey(), className: "dshm-p" }, renderInline(para.join("\n"))));
  }
  return blocks;
}

// src/client/MapPanel.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var CARD_W = 300;
var TURN_H = 96;
var LANE_HEADER_H = 38;
var LANE_MIN_H = 150;
var GAP_X = 90;
var GAP_Y = 46;
var GROUP_GAP = 110;
var turnCache = /* @__PURE__ */ new Map();
var fullTurnCache = /* @__PURE__ */ new Map();
function fetchTurns(sessionId, full = false) {
  const cache = full ? fullTurnCache : turnCache;
  let entry = cache.get(sessionId);
  if (entry === void 0) {
    entry = {
      promise: fetch(`/lineage/api/sessions/${sessionId}/turns${full ? "?full=1" : ""}`).then((r) => r.json())
    };
    cache.set(sessionId, entry);
  }
  return entry.promise;
}
function invalidateTurns(sessionIds) {
  for (const id of sessionIds) {
    turnCache.delete(id);
    fullTurnCache.delete(id);
  }
}
function refetchTurnInto(sessionId, apply2, full = false) {
  const cache = full ? fullTurnCache : turnCache;
  cache.delete(sessionId);
  void fetchTurns(sessionId, full).then(apply2).catch(() => {
  });
}
function layoutGraph(graph, laneHeights, offsets) {
  const positions = /* @__PURE__ */ new Map();
  const groups = [];
  const childrenOf = /* @__PURE__ */ new Map();
  const inGroup = /* @__PURE__ */ new Map();
  const laneHeight = (id) => laneHeights.get(id) ?? LANE_MIN_H;
  for (const node of graph.nodes) {
    const key = node.workspaceId ?? "(none)";
    const list = inGroup.get(key) ?? [];
    list.push(node);
    inGroup.set(key, list);
    if (node.parentSessionId !== null) {
      const children = childrenOf.get(node.parentSessionId) ?? [];
      children.push(node);
      childrenOf.set(node.parentSessionId, children);
    }
  }
  let cursorY = 56;
  let maxX = 0;
  let maxY = 0;
  for (const group of graph.workspaces) {
    const nodes = inGroup.get(group.workspaceId);
    if (nodes === void 0 || nodes.length === 0) continue;
    groups.push({ id: group.workspaceId, title: group.title, y: cursorY - 34 });
    const groupTop = cursorY;
    const byId = new Map(nodes.map((n) => [n.sessionId, n]));
    const ordered = [...nodes].sort((a, b) => a.createdAt - b.createdAt);
    const seen = /* @__PURE__ */ new Set();
    let leafY = groupTop;
    const visit = (node, depth) => {
      seen.add(node.sessionId);
      const x = depth * (CARD_W + GAP_X);
      maxX = Math.max(maxX, x + CARD_W);
      const ownHeight = laneHeight(node.sessionId);
      const children = (childrenOf.get(node.sessionId) ?? []).filter((c) => byId.has(c.sessionId) && !seen.has(c.sessionId));
      let y;
      if (children.length === 0) {
        y = leafY;
        leafY = y + ownHeight + GAP_Y;
      } else {
        let firstChildY = Number.POSITIVE_INFINITY;
        for (const child of children) {
          firstChildY = Math.min(firstChildY, visit(child, depth + 1));
        }
        y = firstChildY;
        leafY = Math.max(leafY, y + ownHeight + GAP_Y);
      }
      maxY = Math.max(maxY, y + ownHeight);
      positions.set(node.sessionId, { x, y, laneHeight: ownHeight });
      return y;
    };
    for (const node of ordered) {
      const parentInGroup = node.parentSessionId !== null && byId.has(node.parentSessionId);
      if (!parentInGroup && !seen.has(node.sessionId)) visit(node, 0);
    }
    cursorY = leafY + GROUP_GAP;
  }
  for (const [sessionId, pos] of positions) {
    const offset = offsets[sessionId];
    if (offset !== void 0) {
      pos.x += offset.dx;
      pos.y += offset.dy;
    }
    maxX = Math.max(maxX, pos.x + CARD_W);
    maxY = Math.max(maxY, pos.y + pos.laneHeight);
  }
  return { positions, groups, width: maxX + 120, height: Math.max(maxY, cursorY) + 120 };
}
function edgePath(from, to, anchorY = null) {
  const x1 = from.x + CARD_W;
  const y1 = from.y + (anchorY ?? LANE_HEADER_H / 2);
  const x2 = to.x;
  const y2 = to.y + LANE_HEADER_H / 2;
  const mid = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
}
function MapPanel({ graph, branches, error, loading, runningById, actions, layouts, onOffsetChange, onBranchesChanged, originSessionId, onClose, onReload }) {
  const [turns, setTurns] = (0, import_react2.useState)(/* @__PURE__ */ new Map());
  const [camera, setCamera] = (0, import_react2.useState)({ x: 40, y: 24, scale: 0.9 });
  const [panning, setPanning] = (0, import_react2.useState)(false);
  const [showSubagents, setShowSubagents] = (0, import_react2.useState)(false);
  const [scope, setScope] = (0, import_react2.useState)("lineage");
  const [reader, setReader] = (0, import_react2.useState)(null);
  const [inputFor, setInputFor] = (0, import_react2.useState)(null);
  const [readerLoading, setReaderLoading] = (0, import_react2.useState)(false);
  const mergedGraph = (0, import_react2.useMemo)(() => {
    if (graph === null) return null;
    if (branches.length === 0) return graph;
    const byId = new Map(graph.nodes.map((n) => [n.sessionId, n]));
    const nodes = [...graph.nodes];
    const edges2 = [...graph.edges];
    for (const stub of branches) {
      const source = byId.get(stub.sourceSessionId);
      if (source === void 0) continue;
      if (nodes.some((n) => n.sessionId === stub.id)) continue;
      nodes.push({
        sessionId: stub.id,
        parentSessionId: stub.sourceSessionId,
        title: stub.title,
        workspaceId: source.workspaceId,
        cwd: source.cwd,
        origin: null,
        delegationDepth: source.delegationDepth,
        isSeeded: true,
        createdAt: Date.parse(stub.createdAt) || 0,
        pending: true
      });
      edges2.push({ from: stub.sourceSessionId, to: stub.id, kind: "fork", atSeq: stub.atSeq });
    }
    return { ...graph, nodes, edges: edges2 };
  }, [graph, branches]);
  const scoped = (0, import_react2.useMemo)(
    () => mergedGraph === null ? null : scopedGraph(mergedGraph, scope, originSessionId),
    [mergedGraph, scope, originSessionId]
  );
  const [followUpFor, setFollowUpFor] = (0, import_react2.useState)(null);
  const [toast, setToast] = (0, import_react2.useState)(null);
  const [viewSize, setViewSize] = (0, import_react2.useState)({ w: 1280, h: 720 });
  const [drag, setDrag] = (0, import_react2.useState)(null);
  const canvasRef = (0, import_react2.useRef)(null);
  const layerRef = (0, import_react2.useRef)(null);
  const dragRef = (0, import_react2.useRef)(null);
  const toastTimer = (0, import_react2.useRef)(0);
  const clickTimer = (0, import_react2.useRef)(0);
  const dragMovedRef = (0, import_react2.useRef)(false);
  const jumpSeqRef = (0, import_react2.useRef)(0);
  const closedRef = (0, import_react2.useRef)(false);
  (0, import_react2.useEffect)(() => () => {
    closedRef.current = true;
    jumpSeqRef.current += 1;
    window.clearTimeout(clickTimer.current);
    window.clearTimeout(toastTimer.current);
  }, []);
  const showToast = (0, import_react2.useCallback)((text, kind = "ok") => {
    setToast({ text, kind });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);
  (0, import_react2.useEffect)(() => {
    if (mergedGraph === null) return;
    let alive = true;
    const merged = new Map(turns);
    for (const node of mergedGraph.nodes) {
      if (node.pending === true) continue;
      if (!merged.has(node.sessionId)) merged.set(node.sessionId, { sessionId: node.sessionId, turns: [] });
    }
    setTurns(new Map(merged));
    const next = mergedGraph.nodes.filter((n) => n.pending !== true).map((n) => n.sessionId).filter((id) => !turns.has(id) || (turns.get(id)?.turns.length ?? 0) === 0);
    let active = 0;
    const pump = () => {
      if (!alive) return;
      while (active < 4 && next.length > 0) {
        const id = next.shift();
        if (id === void 0) return;
        active += 1;
        void fetchTurns(id).then((list) => {
          merged.set(id, list);
        }).catch(() => {
          merged.set(id, { sessionId: id, turns: [] });
        }).finally(() => {
          active -= 1;
          if (alive) {
            setTurns(new Map(merged));
            pump();
          }
        });
      }
    };
    pump();
    return () => {
      alive = false;
    };
  }, [graph]);
  (0, import_react2.useEffect)(() => {
    const measure = () => setViewSize({ w: window.innerWidth, h: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  (0, import_react2.useEffect)(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const onWheel = (event) => {
      event.preventDefault();
      userMovedRef.current = true;
      if (event.shiftKey || event.altKey) {
        setCamera((cam) => ({
          ...cam,
          x: cam.x + (event.shiftKey ? -event.deltaY : -event.deltaX),
          y: cam.y + (event.altKey ? -event.deltaY : -event.deltaX)
        }));
        return;
      }
      setCamera((cam) => {
        const nextScale = Math.min(2.5, Math.max(0.15, cam.scale * Math.exp(-event.deltaY * 16e-4)));
        const rect = canvas.getBoundingClientRect();
        const px = event.clientX - rect.left;
        const py = event.clientY - rect.top;
        const wx = (px - cam.x) / cam.scale;
        const wy = (py - cam.y) / cam.scale;
        return { x: px - wx * nextScale, y: py - wy * nextScale, scale: nextScale };
      });
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);
  (0, import_react2.useEffect)(() => {
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      if (reader !== null) setReader(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, reader]);
  const [measured, setMeasured] = (0, import_react2.useState)({});
  const [cardPos, setCardPos] = (0, import_react2.useState)({});
  const panelRunningRef = (0, import_react2.useRef)({});
  (0, import_react2.useEffect)(() => {
    const stopped = Object.entries(panelRunningRef.current).filter(([id, wasRunning]) => wasRunning && runningById[id] !== true).map(([id]) => id);
    panelRunningRef.current = runningById;
    if (stopped.length === 0) return;
    for (const id of stopped) {
      refetchTurnInto(id, (list) => setTurns((current) => new Map(current).set(id, list)));
    }
  }, [runningById]);
  const laneHeights = (0, import_react2.useMemo)(() => {
    const heights = /* @__PURE__ */ new Map();
    for (const node of mergedGraph?.nodes ?? []) {
      const list = turns.get(node.sessionId);
      const count = list === void 0 ? 1 : Math.max(1, list.turns.length);
      heights.set(node.sessionId, measured[node.sessionId] ?? LANE_HEADER_H + count * (TURN_H + 18));
    }
    return heights;
  }, [mergedGraph, turns, measured]);
  (0, import_react2.useLayoutEffect)(() => {
    const layer = layerRef.current;
    if (layer === null) return;
    const next = {};
    const nextCards = {};
    let changed = false;
    let cardsChanged = false;
    for (const el of Array.from(layer.querySelectorAll(".dshm-lane"))) {
      const id = el.dataset.sessionId;
      if (id === void 0 || id === "") continue;
      const height = el.offsetHeight;
      next[id] = height;
      if (Math.abs((measured[id] ?? 0) - height) > 1) changed = true;
      for (const card of Array.from(el.querySelectorAll(".dshm-card[data-seq]"))) {
        const seq = Number(card.dataset.seq);
        if (!Number.isSafeInteger(seq)) continue;
        const entry = { top: card.offsetTop, height: card.offsetHeight };
        const key = turnKey(id, seq);
        nextCards[key] = entry;
        const prev = cardPos[key];
        if (prev === void 0 || Math.abs(prev.top - entry.top) > 1 || Math.abs(prev.height - entry.height) > 1) cardsChanged = true;
      }
    }
    if (changed) setMeasured((current) => ({ ...current, ...next }));
    if (cardsChanged) setCardPos((current) => ({ ...current, ...nextCards }));
  });
  const mergedOffsets = (0, import_react2.useMemo)(() => {
    const merged = {};
    for (const doc of Object.values(layouts)) {
      for (const [sessionId, offset] of Object.entries(doc.lanes ?? {})) {
        merged[sessionId] = offset;
      }
    }
    if (drag !== null) merged[drag.sessionId] = { dx: drag.dx, dy: drag.dy };
    return merged;
  }, [layouts, drag]);
  const visibleGraph = (0, import_react2.useMemo)(() => {
    if (scoped === null) return null;
    if (showSubagents) return scoped;
    return { ...scoped, nodes: scoped.nodes.filter((n) => n.origin !== "subagent" && (n.delegationDepth ?? 0) === 0) };
  }, [scoped, showSubagents]);
  const layout = (0, import_react2.useMemo)(
    () => visibleGraph === null ? null : layoutGraph(visibleGraph, laneHeights, mergedOffsets),
    [visibleGraph, laneHeights, mergedOffsets]
  );
  const fitToView = (0, import_react2.useCallback)((layoutResult) => {
    if (layoutResult === null || layoutResult.width <= 0) return;
    const scale = Math.min(1, Math.max(0.15, viewSize.w / (layoutResult.width + 80)));
    setCamera({ x: (viewSize.w - layoutResult.width * scale) / 2, y: 20, scale });
  }, [viewSize.w]);
  const centerOnOrigin = (0, import_react2.useCallback)((layoutResult) => {
    if (layoutResult === null || originSessionId === null) return fitToView(layoutResult);
    const pos = layoutResult.positions.get(originSessionId);
    if (pos === void 0) return fitToView(layoutResult);
    setCamera({
      x: Math.round(viewSize.w / 2 - (pos.x + CARD_W / 2)),
      y: Math.round(Math.max(20, viewSize.h / 2 - (pos.y + LANE_HEADER_H + 60))),
      scale: 1
    });
  }, [originSessionId, viewSize.w, viewSize.h, fitToView]);
  const fittedKeyRef = (0, import_react2.useRef)("");
  const userMovedRef = (0, import_react2.useRef)(false);
  (0, import_react2.useEffect)(() => {
    if (layout === null || mergedGraph === null) return;
    if (userMovedRef.current) return;
    const key = `${scope}:${originSessionId}:${mergedGraph.nodes.length}:${turns.size}:${viewSize.w}`;
    if (fittedKeyRef.current === key) return;
    fittedKeyRef.current = key;
    if (scope === "lineage") centerOnOrigin(layout);
    else fitToView(layout);
  }, [layout, mergedGraph, turns.size, viewSize.w, scope, originSessionId, fitToView, centerOnOrigin]);
  const toggleScope = () => {
    setScope((current) => current === "lineage" ? "workspace" : "lineage");
    userMovedRef.current = false;
    fittedKeyRef.current = "";
  };
  const edges = (0, import_react2.useMemo)(() => {
    const list = [];
    if (layout === null || visibleGraph === null) return list;
    for (const edge of visibleGraph.edges) {
      const from = layout.positions.get(edge.from);
      const to = layout.positions.get(edge.to);
      if (from === void 0 || to === void 0) continue;
      const cut = edge.atSeq ?? turns.get(edge.to)?.seedSeq ?? null;
      const anchorY = forkAnchorY(turns.get(edge.from), cut, cardPos);
      list.push({ key: `${edge.from}->${edge.to}`, d: edgePath(from, to, anchorY) });
    }
    return list;
  }, [visibleGraph, layout, turns, cardPos]);
  const onPointerDown = (event) => {
    if (event.target !== event.currentTarget) return;
    userMovedRef.current = true;
    dragRef.current = { startX: event.clientX, startY: event.clientY, camX: camera.x, camY: camera.y };
    setPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event) => {
    const canvasDrag = dragRef.current;
    if (canvasDrag === null) return;
    setCamera((cam) => ({ ...cam, x: canvasDrag.camX + (event.clientX - canvasDrag.startX), y: canvasDrag.camY + (event.clientY - canvasDrag.startY) }));
  };
  const onPointerUp = () => {
    dragRef.current = null;
    setPanning(false);
  };
  const startLaneDrag = (event, node) => {
    if (event.button !== 0 || actions === null) return;
    dragMovedRef.current = false;
    const pos = layout?.positions.get(node.sessionId);
    const autoX = pos !== void 0 ? pos.x - (mergedOffsets[node.sessionId]?.dx ?? 0) : 0;
    const autoY = pos !== void 0 ? pos.y - (mergedOffsets[node.sessionId]?.dy ?? 0) : 0;
    const start = { x: event.clientX, y: event.clientY };
    const origin = { dx: mergedOffsets[node.sessionId]?.dx ?? 0, dy: mergedOffsets[node.sessionId]?.dy ?? 0 };
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const onMove = (moveEvent) => {
      const pointer = moveEvent;
      const dx = Math.round(origin.dx + (pointer.clientX - start.x) / camera.scale);
      const dy = Math.round(origin.dy + (pointer.clientY - start.y) / camera.scale);
      setDrag({ sessionId: node.sessionId, workspaceId: node.workspaceId ?? "", baseX: autoX, baseY: autoY, dx, dy });
    };
    const onUp = (upEvent) => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      const pointer = upEvent;
      const dx = Math.round(origin.dx + (pointer.clientX - start.x) / camera.scale);
      const dy = Math.round(origin.dy + (pointer.clientY - start.y) / camera.scale);
      setDrag(null);
      dragMovedRef.current = dx !== origin.dx || dy !== origin.dy;
      if (node.workspaceId !== null && dragMovedRef.current) {
        onOffsetChange(node.workspaceId, node.sessionId, dx, dy);
      }
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
  };
  const doJump = async (sessionId, messageId) => {
    if (actions === null) return;
    const generation = ++jumpSeqRef.current;
    const isCancelled = () => generation !== jumpSeqRef.current || closedRef.current;
    const title = mergedGraph?.nodes.find((n) => n.sessionId === sessionId)?.title ?? sessionId;
    try {
      const result = await actions.jump(sessionId, messageId, title, sessionId === originSessionId, { isCancelled });
      if (isCancelled()) return;
      if (result === "ok" || result === "session-switched") {
        onClose();
        if (result === "session-switched") showToast("\u5DF2\u6253\u5F00\u4F1A\u8BDD\uFF0C\u4F46\u6CA1\u5B9A\u4F4D\u5230\u90A3\u4E00\u8F6E\uFF08\u5DF2\u505C\u5728\u4F1A\u8BDD\u5F00\u5934\uFF09", "error");
      } else if (result === "session-not-in-sidebar") {
        showToast("\u4FA7\u680F\u91CC\u627E\u4E0D\u5230\u8FD9\u4E2A\u4F1A\u8BDD\uFF08\u8BE6\u60C5\u89C1\u63A7\u5236\u53F0 __dshmJumpDebug\uFF09", "error");
      } else {
        showToast("\u8DF3\u8F6C\u5931\u8D25", "error");
      }
    } catch (cause) {
      if (isCancelled()) return;
      showToast(`\u8DF3\u8F6C\u5931\u8D25\uFF1A${String(cause)}`, "error");
    }
  };
  const doFollowUp = async (sessionId, text) => {
    if (actions === null) return;
    try {
      await actions.followUp(sessionId, text);
      showToast("\u8FFD\u95EE\u5DF2\u53D1\u9001");
      const apply2 = (list) => setTurns((current) => new Map(current).set(sessionId, list));
      window.setTimeout(() => refetchTurnInto(sessionId, apply2), 4e3);
      window.setTimeout(() => refetchTurnInto(sessionId, apply2), 12e3);
    } catch (cause) {
      showToast(`\u8FFD\u95EE\u5931\u8D25\uFF1A${cause instanceof Error ? cause.message : String(cause)}`, "error");
      throw cause;
    }
  };
  const doCreateBranch = async (node, atSeq) => {
    if (actions === null || node.workspaceId === null) {
      showToast("\u8FD9\u6761\u6CF3\u9053\u65E0\u6CD5\u521B\u5EFA\u5206\u652F", "error");
      return;
    }
    try {
      await actions.createBranch({
        sourceSessionId: node.sessionId,
        atSeq,
        title: `${node.title} \u5206\u652F`,
        workspaceId: node.workspaceId
      });
      showToast("\u5206\u652F\u5DF2\u8BB0\u5F55\uFF08\u521B\u5EFA\u4F1A\u8BDD\u63A8\u8FDF\u5230\u7B2C\u4E00\u6B21\u8FFD\u95EE\uFF09");
      onBranchesChanged();
    } catch (cause) {
      showToast(`\u5206\u652F\u5931\u8D25\uFF1A${cause instanceof Error ? cause.message : String(cause)}`, "error");
    }
  };
  const doDeleteBranch = async (id) => {
    if (actions === null) return;
    try {
      await actions.deleteBranch(id);
      showToast("\u5206\u652F\u5B58\u6839\u5DF2\u79FB\u9664");
      onBranchesChanged();
    } catch (cause) {
      showToast(`\u79FB\u9664\u5931\u8D25\uFF1A${String(cause)}`, "error");
    }
  };
  const doRenameSession = async (sessionId, title) => {
    if (actions === null) return;
    try {
      await actions.renameSession(sessionId, title);
      setInputFor(null);
      showToast("\u5DF2\u6539\u540D\uFF08\u539F\u751F\u4FA7\u7A0D\u540E\u540C\u6B65\u663E\u793A\uFF09");
      window.setTimeout(onReload, 600);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      showToast(
        /active write handle/.test(message) ? "\u8BE5\u4F1A\u8BDD\u6B63\u88AB\u53E6\u4E00\u4E2A\u7A97\u53E3/\u9762\u677F\u5360\u7528\uFF0C\u8BF7\u5728\u90A3\u8FB9\u5173\u95ED\u8BE5\u4F1A\u8BDD\u540E\u518D\u6539\u540D" : `\u6539\u540D\u5931\u8D25\uFF1A${message}`,
        "error"
      );
    }
  };
  const doRenameBranch = async (id, title) => {
    if (actions === null) return;
    try {
      await actions.renameBranch(id, title);
      setInputFor(null);
      showToast("\u5206\u652F\u5DF2\u6539\u540D");
      onBranchesChanged();
    } catch (cause) {
      showToast(`\u6539\u540D\u5931\u8D25\uFF1A${cause instanceof Error ? cause.message : String(cause)}`, "error");
    }
  };
  const doActivateBranch = async (stub, text) => {
    if (actions === null) return;
    try {
      const { sessionId } = await actions.activateBranch(stub, text);
      showToast(`\u5206\u652F\u5DF2\u521B\u5EFA\u4E3A\u4F1A\u8BDD ${sessionId.slice(0, 8)}\u2026\uFF0C\u8FFD\u95EE\u5DF2\u53D1\u9001`);
      onBranchesChanged();
      window.setTimeout(onReload, 400);
    } catch (cause) {
      showToast(`\u8FFD\u95EE\u5931\u8D25\uFF1A${cause instanceof Error ? cause.message : String(cause)}`, "error");
      throw cause;
    }
  };
  const openReader = (sessionId, turn, card) => {
    const rect = card?.getBoundingClientRect();
    setReader({
      sessionId,
      turn,
      sourceRect: rect !== void 0 ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : { left: viewSize.w / 2 - 160, top: viewSize.h / 2 - 90, width: 320, height: 180 }
    });
    if (actions === null) return;
    setReaderLoading(true);
    void fetchTurns(sessionId, true).then((list) => {
      const full = list.turns.find((t) => t.startSeq === turn.startSeq);
      if (full !== void 0) setReader((current) => current === null ? current : { ...current, turn: full });
    }).catch(() => {
    }).finally(() => setReaderLoading(false));
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dshm-overlay", role: "dialog", "aria-label": "\u4F1A\u8BDD\u5730\u56FE", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        ref: canvasRef,
        className: `dshm-canvas${panning ? " is-panning" : ""}`,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onDoubleClick: (event) => {
          if (event.target.closest("textarea, input") !== null) return;
          userMovedRef.current = false;
          fittedKeyRef.current = "";
          if (scope === "lineage") centerOnOrigin(layout);
          else fitToView(layout);
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dshm-topbar", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dshm-btn", onClick: onClose, children: "\u8FD4\u56DE\u5BF9\u8BDD\uFF08Esc\uFF09" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dshm-btn", onClick: onReload, children: "\u5237\u65B0" }),
            originSessionId !== null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dshm-btn", onClick: toggleScope, children: scope === "lineage" ? "\u5C55\u5F00\u4E3A\u5DE5\u4F5C\u533A\u5730\u56FE" : "\u56DE\u5230\u8840\u7F18\u56FE" }) : null,
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dshm-btn", onClick: () => setShowSubagents((value) => !value), children: showSubagents ? "\u9690\u85CF subagent" : "\u663E\u793A subagent" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dshm-hint", children: [
              scope === "lineage" ? "\u8840\u7F18\u56FE\uFF08\u6839\u4F1A\u8BDD\u6574\u68F5\u6811 \xB7 \u8DE8\u5206\u7EC4\u5B8C\u6574\uFF09\xB7 " : "\u5DE5\u4F5C\u533A\u89C6\u89D2\uFF08\u6241\u5E73\uFF09\xB7 ",
              "\u6EDA\u8F6E\u7F29\u653E \xB7 Shift/Alt+\u6EDA\u8F6E\u5E73\u79FB \xB7 \u62D6\u62FD\u6807\u9898\u79FB\u52A8\u6CF3\u9053 \xB7 \u6807\u9898\u5355\u51FB\u6253\u5F00/\u53CC\u51FB\u6539\u540D \xB7 \u53CC\u51FB\u5361\u7247\u5C55\u5F00\u9605\u8BFB \xB7 \u53CC\u51FB\u7A7A\u767D\u590D\u4F4D"
            ] }),
            loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dshm-hint", children: "\u52A0\u8F7D\u4E2D\u2026" }) : null,
            error !== null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dshm-hint", style: { color: "#b42323" }, children: error }) : null
          ] }),
          toast !== null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `dshm-toast${toast.kind === "error" ? " is-error" : ""}`, children: toast.text }) : null,
          layout !== null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { ref: layerRef, className: "dshm-layer", style: { transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})` }, children: [
            layout.groups.map((group) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dshm-group-label", style: { top: group.y, left: 0, width: layout.width }, children: [
              "\u25A4 ",
              group.title
            ] }, group.id)),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { className: "dshm-edges", width: Math.max(layout.width, 1), height: Math.max(layout.height, 1), style: { left: 0, top: 0 }, children: edges.map(({ key, d }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { className: "dshm-edge", d }, key)) }),
            visibleGraph?.nodes.map((node) => {
              const pos = layout.positions.get(node.sessionId);
              if (pos === void 0) return null;
              const list = turns.get(node.sessionId);
              const isSub = node.origin === "subagent" || (node.delegationDepth ?? 0) > 0;
              return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "div",
                {
                  "data-session-id": node.sessionId,
                  className: `dshm-lane${isSub ? " is-sub" : ""}${node.pending === true ? " is-pending" : ""}`,
                  style: { left: pos.x, top: pos.y, width: CARD_W },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                      "div",
                      {
                        className: `dshm-session-title${actions !== null ? " is-grabbable" : ""}`,
                        title: node.pending === true ? `${node.title}\uFF08\u53CC\u51FB\u6539\u540D \xB7 \u62D6\u62FD\u79FB\u52A8\uFF09` : `${node.title}\uFF08\u5355\u51FB\u6253\u5F00 \xB7 \u53CC\u51FB\u6539\u540D \xB7 \u62D6\u62FD\u79FB\u52A8\uFF09`,
                        onPointerDown: (event) => {
                          if (event.target.closest("button") === null) startLaneDrag(event, node);
                        },
                        onClick: (event) => {
                          if (actions === null || node.pending === true) return;
                          if (event.target.closest("button") !== null) return;
                          if (dragMovedRef.current) {
                            dragMovedRef.current = false;
                            return;
                          }
                          window.clearTimeout(clickTimer.current);
                          clickTimer.current = window.setTimeout(() => {
                            void doJump(node.sessionId, list?.turns[0]?.messageId ?? null);
                          }, 260);
                        },
                        onDoubleClick: (event) => {
                          if (event.target.closest("button") !== null) return;
                          event.stopPropagation();
                          window.clearTimeout(clickTimer.current);
                          if (actions === null) return;
                          setInputFor((current) => current?.sessionId === node.sessionId && (current.kind === "rename" || current.kind === "renameBranch") ? null : { kind: node.pending === true ? "renameBranch" : "rename", sessionId: node.sessionId });
                        },
                        children: [
                          isSub ? "[sub] " : "",
                          node.pending === true ? "\u25C7 " : node.isSeeded ? "\u2442 " : "",
                          node.title,
                          runningById[node.sessionId] === true ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dshm-badge is-running", children: "\u8FD0\u884C\u4E2D" }) : null,
                          node.pending === true && actions !== null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dshm-title-x", title: "\u5220\u9664\u5206\u652F\u5B58\u6839", onClick: () => doDeleteBranch(node.sessionId), children: "\u2715" }) : null
                        ]
                      }
                    ),
                    inputFor !== null && inputFor.sessionId === node.sessionId && (inputFor.kind === "rename" || inputFor.kind === "renameBranch") ? inputFor.kind === "renameBranch" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      InputRow,
                      {
                        placeholder: "\u65B0\u7684\u5206\u652F\u540D\u2026\uFF08Enter \u786E\u8BA4\uFF09",
                        initial: "",
                        onSend: (text) => doRenameBranch(node.sessionId, text),
                        onCancel: () => setInputFor(null)
                      }
                    ) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      InputRow,
                      {
                        placeholder: "\u65B0\u7684\u4F1A\u8BDD\u6807\u9898\u2026\uFF08Enter \u786E\u8BA4\uFF09",
                        initial: node.title,
                        onSend: (text) => doRenameSession(node.sessionId, text),
                        onCancel: () => setInputFor(null)
                      }
                    ) : null,
                    list === void 0 && node.pending !== true ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dshm-card", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dshm-loading", children: "\u8BFB\u53D6\u4F1A\u8BDD\u2026" }) }) : null,
                    list !== void 0 && list.turns.length === 0 && node.pending !== true ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dshm-card", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dshm-loading", children: "\uFF08\u65E0\u6295\u5F71\u8F6E\u6B21\uFF1A\u7A7A\u767D\u6216\u5168\u90E8\u4E3A\u6CE8\u5165\u5185\u5BB9\uFF09" }) }) : null,
                    list !== void 0 && list.turns.length > 0 ? list.turns.map((turn) => {
                      const badge = statusBadge(turn);
                      const failed = turn.tools.filter((tool) => !tool.ok).length;
                      const pendingApproval = turn.approvals.filter((a) => a.pending).length;
                      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                        "div",
                        {
                          "data-seq": turn.startSeq,
                          className: `dshm-card${turn.status === "error" ? " is-error" : ""}`,
                          onClick: (event) => {
                            const target = event.target;
                            if (target.closest("button") !== null || target.closest(".dshm-followup") !== null) return;
                            if (actions === null || target.closest(".dshm-q") === null) return;
                            if (dragMovedRef.current) {
                              dragMovedRef.current = false;
                              return;
                            }
                            window.clearTimeout(clickTimer.current);
                            clickTimer.current = window.setTimeout(() => {
                              void doJump(node.sessionId, turn.messageId);
                            }, 260);
                          },
                          onDoubleClick: (event) => {
                            const target = event.target;
                            if (target.closest("button") !== null || target.closest(".dshm-followup") !== null) return;
                            event.stopPropagation();
                            window.clearTimeout(clickTimer.current);
                            if (actions === null) return;
                            openReader(node.sessionId, turn, event.currentTarget);
                          },
                          children: [
                            badge !== null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `dshm-badge ${badge.className}`, children: badge.label }) : null,
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dshm-q", title: actions !== null ? "\u5355\u51FB\u8DF3\u8F6C\u5230\u539F\u751F\u5BF9\u8BDD\u7684\u8FD9\u4E00\u8F6E \xB7 \u53CC\u51FB\u5C55\u5F00\u9605\u8BFB" : void 0, children: turn.question }),
                            turn.answer !== "" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dshm-a", children: turn.answer }) : null,
                            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dshm-chips", children: [
                              turn.tools.slice(0, 4).map((tool, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `dshm-chip${tool.ok ? "" : " is-fail"}`, children: tool.name }, index)),
                              turn.tools.length > 4 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dshm-chip", children: [
                                "+",
                                turn.tools.length - 4
                              ] }) : null,
                              failed > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dshm-chip is-fail", children: [
                                failed,
                                " \u5931\u8D25"
                              ] }) : null,
                              turn.todoCount > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dshm-chip", children: [
                                "todo\xD7",
                                turn.todoCount
                              ] }) : null,
                              pendingApproval > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dshm-chip is-warn", children: [
                                pendingApproval,
                                " \u5F85\u5BA1\u6279"
                              ] }) : null
                            ] }),
                            actions !== null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                              "button",
                              {
                                type: "button",
                                className: "dshm-branch-btn",
                                title: "\u4ECE\u6B64\u5206\u652F\uFF08\u7EE7\u627F\u5230\u8FD9\u4E00\u8F6E\u7ED3\u675F\u4E3A\u6B62\u7684\u5168\u90E8\u4E0A\u4E0B\u6587\uFF0C\u8FDE\u7EBF\u7531\u6B64\u6309\u94AE\u5F15\u51FA\uFF09",
                                onClick: () => doCreateBranch(node, turn.endSeq ?? turn.startSeq),
                                children: ">"
                              }
                            ) : null
                          ]
                        },
                        turn.startSeq
                      );
                    }) : null,
                    actions !== null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      AskCard,
                      {
                        placeholder: node.pending === true ? "\u7B2C\u4E00\u6B21\u8FFD\u95EE\u2014\u2014\u6B64\u523B\u624D\u771F\u6B63\u521B\u5EFA\u8FD9\u4E2A\u5206\u652F\u7684\u4F1A\u8BDD\uFF08Enter \u53D1\u9001\uFF09" : "\u8FFD\u95EE\u8FD9\u4E2A\u4F1A\u8BDD\u2026\uFF08Enter \u53D1\u9001\uFF0CShift+Enter \u6362\u884C\uFF09",
                        onSend: (text) => node.pending === true ? doActivateBranch(branches.find((b) => b.id === node.sessionId), text) : doFollowUp(node.sessionId, text)
                      }
                    ) : null
                  ]
                },
                node.sessionId
              );
            })
          ] }) : null
        ]
      }
    ),
    reader !== null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dshm-reader-scrim", onClick: () => setReader(null) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReaderCard, { reader, loading: readerLoading, onClose: () => setReader(null) })
    ] }) : null
  ] });
}
function ReaderCard({ reader, loading, onClose }) {
  const cardRef = (0, import_react2.useRef)(null);
  (0, import_react2.useLayoutEffect)(() => {
    const el = cardRef.current;
    if (el === null) return;
    const rect = el.getBoundingClientRect();
    const src = reader.sourceRect;
    const dx = src.left + src.width / 2 - (rect.left + rect.width / 2);
    const dy = src.top + src.height / 2 - (rect.top + rect.height / 2);
    const scale = Math.max(0.2, Math.min(1, src.width / Math.max(rect.width, 1)));
    el.style.transition = "none";
    el.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${scale})`;
    void el.getBoundingClientRect();
    const raf = requestAnimationFrame(() => {
      el.style.transition = "transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)";
      el.style.transform = "translate(-50%, -50%)";
    });
    return () => cancelAnimationFrame(raf);
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { ref: cardRef, className: "dshm-reader", role: "dialog", "aria-label": "\u5C55\u5F00\u9605\u8BFB", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dshm-reader-bar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dshm-reader-title", children: reader.turn.question.slice(0, 48) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dshm-btn", onClick: onClose, children: "\u5173\u95ED" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dshm-reader-body dshm-md", children: [
      loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dshm-hint", children: "\u52A0\u8F7D\u5168\u6587\u2026" }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dshm-reader-q", children: renderMarkdown(reader.turn.question) }),
      reader.turn.answer !== "" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dshm-reader-a", children: renderMarkdown(reader.turn.answer) }) : null
    ] })
  ] });
}
function AskCard({ placeholder, onSend }) {
  const [text, setText] = (0, import_react2.useState)("");
  const areaRef = (0, import_react2.useRef)(null);
  const send = async () => {
    const trimmed = text.trim();
    if (trimmed === "") return;
    try {
      await onSend(trimmed);
      setText("");
      if (areaRef.current !== null) areaRef.current.style.height = "auto";
    } catch {
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dshm-card is-ask", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "textarea",
    {
      ref: areaRef,
      rows: 1,
      value: text,
      placeholder,
      onChange: (event) => {
        setText(event.target.value);
        const el = event.target;
        el.style.height = "auto";
        el.style.height = `${Math.min(160, el.scrollHeight)}px`;
      },
      onKeyDown: (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          void send();
        }
      }
    }
  ) });
}
function InputRow({ onSend, onCancel, placeholder, initial }) {
  const [text, setText] = (0, import_react2.useState)(initial);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dshm-followup", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "input",
    {
      autoFocus: true,
      type: "text",
      value: text,
      placeholder,
      onChange: (event) => setText(event.target.value),
      onKeyDown: (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          const trimmed = text.trim();
          if (trimmed !== "") onSend(trimmed);
        }
        if (event.key === "Escape") onCancel();
      },
      style: { height: 28, borderRadius: 6, border: "1px solid #94a3b8", padding: "0 8px", fontSize: 12 }
    }
  ) });
}
function statusBadge(turn) {
  if (turn.status === "error") return { label: "\u51FA\u9519", className: "is-error" };
  if (turn.status === "cancelled") return { label: "\u5DF2\u53D6\u6D88", className: "is-cancelled" };
  return null;
}

// src/client/glue.ts
function stripRowChrome(label) {
  return label.replace(/\s*Session actions for[\s\S]*$/, "").replace(/\d+(?:min|s|h|d|w)\s*$/i, "").replace(/\d+(?:秒钟?|分钟|小时|天|周|个月|月|年)\s*$/, "").trim();
}
function stripRowChromeAggressive(label) {
  return stripRowChrome(label).replace(/^(?:completed|running|errored|error|cancelled|canceled|queued|waiting|pinned|archived|已完成|运行中|出错|已取消|排队中|已置顶|已归档)\s*/i, "").replace(/\s*(?:just now|now|(?:\d+|a few)?\s*(?:seconds?|minutes?|mins?|hours?|hrs?|days?|weeks?|months?)|today|yesterday|(?:\d+\s*)?(?:秒钟?|分钟|小时|天|周|个月|月|年)前?|刚刚)\s*$/i, "").trim();
}
async function openTurnInConversation(sessionId, messageId, displayTitle, isCurrentSession = false, opts = {}) {
  const cancelled = () => opts.isCancelled?.() === true;
  if (typeof document === "undefined" || cancelled()) return "no-dom";
  const wanted = displayTitle.trim();
  const anchorSelector = messageId !== null && messageId !== "" ? `[data-chat-anchor-key$="input-message${messageId}"]` : null;
  const scrollWhenPresent = async (timeoutMs) => {
    if (anchorSelector === null) return "turn-not-found";
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (cancelled()) return "no-dom";
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (cancelled()) return "no-dom";
      const anchor = document.querySelector(anchorSelector);
      if (anchor !== null) {
        anchor.scrollIntoView({ block: "start" });
        return "ok";
      }
    }
    return "turn-not-found";
  };
  if (isCurrentSession) {
    await scrollWhenPresent(3e3);
    return "ok";
  }
  const isGroupRow = (el) => el.getAttribute("aria-expanded") !== null;
  const isChromeLeaf = (text) => /^(?:completed|running|errored|error|cancelled|canceled|queued|waiting|pinned|archived|已完成|运行中|出错|已取消|排队中|已置顶|已归档|now|刚刚|\d+(?:min|s|h|d|w)|\d+(?:秒钟?|分钟|小时|天|周|个月|月|年))$/i.test(text);
  const findByLeaf = () => {
    const items = Array.from(document.querySelectorAll('[role="treeitem"]'));
    return items.find((item) => !isGroupRow(item) && Array.from(item.querySelectorAll("*")).some((el) => el.children.length === 0 && (el.textContent ?? "").trim() === wanted && !isChromeLeaf(wanted)));
  };
  const findRow = () => {
    if (wanted === "") return void 0;
    const byLeaf = findByLeaf();
    if (byLeaf !== void 0) return byLeaf;
    const items = Array.from(document.querySelectorAll('[role="treeitem"]'));
    return items.find((item) => stripRowChrome(item.getAttribute("aria-label") ?? item.textContent ?? "") === wanted) ?? items.find((item) => stripRowChromeAggressive(item.getAttribute("aria-label") ?? item.textContent ?? "") === wanted);
  };
  const expandTruncatedList = () => {
    const more = Array.from(document.querySelectorAll("button")).find(
      (button) => /more sessions|更多会话|显示更多/i.test(button.textContent?.trim() ?? "")
    );
    if (more === void 0) return false;
    more.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    return true;
  };
  const expandCollapsedGroups = () => {
    const collapsed = Array.from(document.querySelectorAll('[role="treeitem"][aria-expanded="false"]'));
    if (collapsed.length === 0) return false;
    for (const group of collapsed) {
      group.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    }
    return true;
  };
  const scrollScan = async () => {
    if (cancelled()) return void 0;
    const tree = document.querySelector('[role="tree"]');
    let scroller = null;
    for (let el = tree?.parentElement; el !== null && el !== void 0; el = el.parentElement) {
      if (el.scrollHeight > el.clientHeight + 4 && el.clientHeight > 120) {
        scroller = el;
        break;
      }
    }
    if (scroller === null) return void 0;
    for (let step = 0; step < 30; step += 1) {
      if (cancelled()) return void 0;
      const row2 = findRow();
      if (row2 !== void 0) return row2;
      const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
      if (atBottom) return void 0;
      scroller.scrollTop += Math.max(240, Math.round(scroller.clientHeight * 0.8));
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    return findRow();
  };
  let row = findRow();
  for (let attempt = 0; row === void 0 && attempt < 6; attempt += 1) {
    if (cancelled()) return "no-dom";
    const expanded = expandTruncatedList() || expandCollapsedGroups();
    if (!expanded) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
    row = findRow();
  }
  if (cancelled()) return "no-dom";
  if (row === void 0) row = await scrollScan();
  if (cancelled()) return "no-dom";
  if (row === void 0) {
    const items = Array.from(document.querySelectorAll('[role="treeitem"]'));
    window.__dshmJumpDebug = {
      wanted,
      treeitemCount: items.length,
      collapsedGroups: document.querySelectorAll('[role="treeitem"][aria-expanded="false"]').length,
      rowLabels: items.map((item) => (item.getAttribute("aria-label") ?? item.textContent ?? "").slice(0, 120))
    };
    console.warn("[dsh-lineage] jump target row not found; see window.__dshmJumpDebug", window.__dshmJumpDebug);
    return "session-not-in-sidebar";
  }
  const deepest = Array.from(row.querySelectorAll("*")).filter((el) => el.children.length === 0 && (el.textContent ?? "").trim().startsWith(wanted));
  const clickTarget = deepest.at(-1) ?? row;
  if (cancelled()) return "no-dom";
  clickTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  const scrolled = await scrollWhenPresent(6e3);
  if (cancelled()) return "no-dom";
  return scrolled === "turn-not-found" ? "session-switched" : scrolled;
}
async function sendFollowUp(sessions, sessionId, text) {
  const promptExisting = () => sessions.binding?.(sessionId);
  const runPrompt = async (session) => {
    const result = await session.prompt([{ type: "text", text }], "queue");
    if (result && result.ok !== true && result.error !== void 0) {
      throw new Error(result.error.message ?? "DSH \u672A\u63A5\u53D7\u8FD9\u6761\u6D88\u606F");
    }
  };
  const existing = promptExisting()?.session;
  if (existing !== void 0) return runPrompt(existing);
  if (typeof sessions.using !== "function") throw new Error("\u4F1A\u8BDD\u672A\u5728\u5BA2\u6237\u7AEF\u5B9E\u4F8B\u5316\uFF0C\u4E14\u5F53\u524D\u7248\u672C\u4E0D\u652F\u6301\u81EA\u52A8\u5B9E\u4F8B\u5316");
  await sessions.using(sessionId, { source: "workspaceOperation" }, async (reference) => {
    const binding = reference?.binding ?? sessions.binding?.(sessionId);
    const session = binding?.session ?? reference.session;
    if (session === void 0) throw new Error("\u4F1A\u8BDD\u5B9E\u4F8B\u5316\u5931\u8D25\uFF0C\u8BF7\u5148\u5728\u539F\u751F\u5BF9\u8BDD\u4E2D\u6253\u5F00\u4E00\u6B21");
    await runPrompt(session);
  });
}
async function forkSessionAt(sessions, sessionId, atSeq) {
  return sessions.fork({ sessionId, atSeq, increaseTitle: true });
}
async function renameSession(sessions, sessionId, title) {
  const run = async (session) => {
    if (typeof session.rename !== "function") throw new Error("\u5F53\u524D\u7248\u672C\u4E0D\u652F\u6301\u4ECE\u5730\u56FE\u6539\u540D");
    const result = await session.rename(title);
    if (result && result.ok !== true && result.error !== void 0) {
      throw new Error(result.error.message ?? "\u6539\u540D\u672A\u88AB\u6267\u884C");
    }
  };
  const binding = sessions.binding?.(sessionId);
  if (binding?.session !== void 0) {
    await run(binding.session);
    return;
  }
  await sessions.using(sessionId, { source: "workspaceOperation" }, async (reference) => {
    const refBinding = reference?.binding ?? sessions.binding?.(sessionId);
    const session = refBinding?.session ?? reference.session;
    if (session === void 0) throw new Error("\u4F1A\u8BDD\u5B9E\u4F8B\u5316\u5931\u8D25\uFF0C\u65E0\u6CD5\u6539\u540D");
    await run(session);
  });
}

// src/client/styles.ts
var MAP_STYLES = `
.dshm-overlay { position: fixed; inset: 0; z-index: 60; background: #f5f7fa; user-select: none; -webkit-user-select: none; }
.dshm-reader, .dshm-followup, .dshm-card.is-ask { user-select: text; -webkit-user-select: text; }
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
  position: relative;
  box-sizing: border-box; width: 300px; border: 1px solid #d7dee8; border-radius: 10px;
  background: #ffffff; padding: 8px 10px; margin-bottom: 18px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  font: 400 12px/1.5 Inter, system-ui, sans-serif; color: #334155;
}
body[data-ds-dark-theme] .dshm-card { background: #20242c; border-color: #343b46; color: #cbd5e1; }
.dshm-card.is-error { border-color: #f0a5a5; }
.dshm-q {
  margin: 0 0 6px; font-weight: 600; color: #0f172a; cursor: pointer;
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
  border-radius: 999px; padding: 1px 8px; font-size: 10px; font-weight: 600; font-family: inherit;
  background: #eef2f7; color: #475569;
}
body[data-ds-dark-theme] .dshm-chip { background: #2a303a; color: #94a3b8; }
.dshm-chip.is-fail { background: #fdeaea; color: #b42323; }
body[data-ds-dark-theme] .dshm-chip.is-fail { background: #3a2626; color: #e0a0a0; }
/* Trailing ask card: the whole card is one input (dashed to read as "open
   slot" rather than a rendered turn). */
.dshm-card.is-ask { border-style: dashed; padding: 6px 10px; }
.dshm-card.is-ask textarea {
  display: block; width: 100%; resize: none; border: 0; outline: none; background: transparent;
  font: inherit; color: inherit; line-height: 1.5; padding: 2px 0; max-height: 160px; overflow-y: auto;
}
.dshm-card.is-ask textarea::placeholder { color: #94a3b8; }
body[data-ds-dark-theme] .dshm-card.is-ask textarea::placeholder { color: #6b7686; }
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
/* position:relative makes the title the containing block for its \u2715 (a stub
   lane's delete button) \u2014 otherwise it anchors to the lane and drifts over
   the ask card. */
.dshm-session-title { position: relative; }
.dshm-session-title.is-grabbable { cursor: grab; }
.dshm-session-title.is-grabbable:active { cursor: grabbing; }
/* Delete-stub \u2715 sits inside the pending lane's title bar (open/rename merged
   into the same block: click opens, double click renames, drag moves). */
.dshm-lane.is-pending .dshm-session-title { padding-right: 30px; }
.dshm-title-x {
  position: absolute; right: 7px; top: 50%; transform: translateY(-50%);
  width: 18px; height: 18px; border-radius: 50%; padding: 0;
  border: 1px solid #cbd5e1; background: rgba(255, 255, 255, 0.75); color: #64748b;
  font: 600 11px/1 Inter, system-ui, sans-serif; cursor: pointer;
}
.dshm-title-x:hover { background: #fdeaea; color: #b42323; border-color: #f0a5a5; }
body[data-ds-dark-theme] .dshm-title-x { background: #2a303a; border-color: #475569; color: #94a3b8; }
body[data-ds-dark-theme] .dshm-title-x:hover { background: #3a2626; color: #e0a0a0; }
/* Branch affordance: a circular button straddling the card's right edge; the
   fork edge leaves from this point (card top + height/2 = the button center). */
.dshm-branch-btn {
  position: absolute; right: -11px; top: 50%; transform: translateY(-50%);
  width: 22px; height: 22px; border-radius: 50%; padding: 0;
  border: 1px solid #cbd5e1; background: #ffffff; color: #64748b;
  font: 700 13px/1 Inter, system-ui, sans-serif; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12); z-index: 1;
}
.dshm-branch-btn:hover { background: #e0e7ff; color: #3730a3; border-color: #a5b4fc; }
body[data-ds-dark-theme] .dshm-branch-btn { background: #262b33; border-color: #475569; color: #94a3b8; }
body[data-ds-dark-theme] .dshm-branch-btn:hover { background: #26304a; color: #a5b4fc; }
.dshm-chip.is-warn { background: #fef3c7; color: #92400e; }
body[data-ds-dark-theme] .dshm-chip.is-warn { background: #3a3222; color: #fcd34d; }
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
`;

// src/client/index.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var inject = ["slots", "sessions"];
function subscribeHook(source) {
  return function useOpenState() {
    const [value, setValue] = (0, import_react3.useState)(() => source.getSnapshot());
    (0, import_react3.useEffect)(() => source.subscribe(() => setValue(source.getSnapshot())), []);
    return value;
  };
}
function extractSessionFacts(snapshot) {
  let ids = [];
  if (Array.isArray(snapshot?.ids)) ids = snapshot.ids.filter((x) => typeof x === "string");
  else if (Array.isArray(snapshot)) ids = snapshot.map((entry) => entry?.id).filter((x) => typeof x === "string");
  const byId = snapshot?.byId;
  const running = {};
  const titles = {};
  for (const id of ids) {
    const entry = byId instanceof Map ? byId.get(id) : byId?.[id];
    if (entry?.running === true) running[id] = true;
    if (typeof entry?.displayTitle === "string" && entry.displayTitle !== "") titles[id] = entry.displayTitle;
  }
  return { ids, running, titles };
}
function HeaderButton(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", onClick: () => props.open(props.sessionId), style: { cursor: "pointer" }, children: "\u4F1A\u8BDD\u5730\u56FE" });
}
function MapOverlayEntry({ useOpen, onClose, useSessions, actions, origin }) {
  const open = useOpen() === true;
  const originSessionId = typeof origin === "function" ? origin() : null;
  const snapshot = typeof useSessions === "function" ? useSessions((value) => value) : void 0;
  const facts = (0, import_react3.useMemo)(() => extractSessionFacts(snapshot), [snapshot]);
  const [graph, setGraph] = (0, import_react3.useState)(null);
  const [error, setError] = (0, import_react3.useState)(null);
  const [loading, setLoading] = (0, import_react3.useState)(false);
  const [layouts, setLayouts] = (0, import_react3.useState)({});
  const [branches, setBranches] = (0, import_react3.useState)([]);
  const load = (0, import_react3.useCallback)(() => {
    setLoading(true);
    void fetch("/lineage/api/graph").then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }).then((body) => {
      setGraph(body);
      setError(null);
    }).catch((cause) => setError(`\u5730\u56FE\u52A0\u8F7D\u5931\u8D25\uFF1A${String(cause)}`)).finally(() => setLoading(false));
  }, []);
  const refreshBranches = (0, import_react3.useCallback)(() => {
    void fetch("/lineage/api/branches").then((response) => response.ok ? response.json() : { branches: [] }).then((body) => setBranches(body.branches ?? [])).catch(() => {
    });
  }, []);
  const loadedLayouts = (0, import_react3.useRef)(/* @__PURE__ */ new Set());
  (0, import_react3.useEffect)(() => {
    if (graph === null || actions === null) return;
    refreshBranches();
    for (const group of graph.workspaces) {
      if (loadedLayouts.current.has(group.workspaceId)) continue;
      loadedLayouts.current.add(group.workspaceId);
      void fetch(`/lineage/api/layout/${encodeURIComponent(group.workspaceId)}`).then((response) => response.ok ? response.json() : { layout: null }).then((body) => {
        if (body.layout !== null) {
          setLayouts((current) => ({ ...current, [group.workspaceId]: body.layout }));
        }
      }).catch(() => {
      });
    }
  }, [graph, actions]);
  const onOffsetChange = (0, import_react3.useCallback)((workspaceId, sessionId, dx, dy) => {
    setLayouts((current) => {
      const lanes = { ...current[workspaceId]?.lanes ?? {}, [sessionId]: { dx, dy } };
      const doc = { workspaceId, lanes };
      void fetch(`/lineage/api/layout/${encodeURIComponent(workspaceId)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lanes })
      }).catch(() => {
      });
      return { ...current, [workspaceId]: doc };
    });
  }, []);
  const loadedOnce = (0, import_react3.useRef)(false);
  const idsSignature = facts.ids.join(",");
  (0, import_react3.useEffect)(() => {
    if (!open) {
      loadedOnce.current = false;
      loadedLayouts.current = /* @__PURE__ */ new Set();
      return;
    }
    if (!loadedOnce.current) {
      loadedOnce.current = true;
      load();
    }
  }, [open, load, idsSignature]);
  const prevIds = (0, import_react3.useRef)(null);
  (0, import_react3.useEffect)(() => {
    if (!open || !loadedOnce.current) {
      prevIds.current = null;
      return;
    }
    if (prevIds.current !== null && idsSignature !== prevIds.current) load();
    prevIds.current = idsSignature;
  }, [open, idsSignature, load]);
  const runningRef = (0, import_react3.useRef)({});
  (0, import_react3.useEffect)(() => {
    for (const [id, wasRunning] of Object.entries(runningRef.current)) {
      if (wasRunning && facts.running[id] !== true) invalidateTurns([id]);
    }
    runningRef.current = facts.running;
  }, [facts]);
  if (!open) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    MapPanel,
    {
      graph,
      branches,
      error,
      loading,
      runningById: facts.running,
      actions,
      layouts,
      onOffsetChange,
      onBranchesChanged: refreshBranches,
      originSessionId,
      onClose,
      onReload: load
    }
  );
}
function apply(ctx) {
  const openSource = createSource(false);
  const originRef = { current: null };
  const actions = ctx.sessions ? {
    jump: (sessionId, messageId, displayTitle, isCurrentSession, opts) => openTurnInConversation(sessionId, messageId, displayTitle, isCurrentSession, opts),
    followUp: (sessionId, text) => sendFollowUp(ctx.sessions, sessionId, text),
    renameSession: (sessionId, title) => renameSession(ctx.sessions, sessionId, title),
    createBranch: (input) => fetch("/lineage/api/branches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    }).then(async (response) => {
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? `HTTP ${response.status}`);
      return (await response.json()).branch;
    }),
    renameBranch: (id, title) => fetch(`/lineage/api/branches/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title })
    }).then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    }),
    deleteBranch: (id) => fetch(`/lineage/api/branches/${id}`, { method: "DELETE" }).then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    }),
    activateBranch: async (stub, text) => {
      const sessions = ctx.sessions;
      const childId = await forkSessionAt(sessions, stub.sourceSessionId, stub.atSeq ?? void 0);
      await sendFollowUp(sessions, childId, text);
      await renameSession(sessions, childId, stub.title).catch(() => {
      });
      await fetch(`/lineage/api/branches/${stub.id}`, { method: "DELETE" }).catch(() => {
      });
      return { sessionId: childId };
    }
  } : null;
  const style = document.createElement("style");
  style.textContent = MAP_STYLES;
  document.head.append(style);
  const isMac = /\bMac\b/.test(navigator.platform) || /Macintosh/.test(navigator.userAgent);
  if (isMac) document.documentElement.classList.add("dshm-mac");
  const contribute = (key, meta, component) => {
    ctx.slots.inject(key, () => {
      try {
        ctx.slots.register(meta, component);
      } catch (error) {
        console.error("[dsh-lineage] slot registration failed:", meta.name, error);
        window.__dshmRegisterError = { slot: meta.name, error: String(error) };
      }
    });
  };
  contribute("conversation.session.header.actions", {
    name: "conversation.session.header.actions",
    id: "dsh-lineage-open",
    order: 900,
    inject: () => ({
      open: (sessionId) => {
        originRef.current = typeof sessionId === "string" ? sessionId : null;
        openSource.set(true);
      }
    })
  }, HeaderButton);
  contribute("shell.overlay", {
    name: "shell.overlay",
    id: "dsh-lineage-map",
    order: 60,
    inject: () => ({ onClose: () => openSource.set(false), useOpen: subscribeHook(openSource), actions, origin: () => originRef.current })
  }, MapOverlayEntry);
  ctx.effect(() => () => {
    style.remove();
    if (isMac) document.documentElement.classList.remove("dshm-mac");
  }, "dsh-lineage: styles");
}

		// After the bundle: esbuild replaces module.exports (__toCommonJS),
		// so the Module marker lands on the final object, matching the
		// official clientBundle() output shape.
		Object.defineProperty(module.exports, Symbol.toStringTag, { value: "Module" });
		return module.exports;
	}
});
