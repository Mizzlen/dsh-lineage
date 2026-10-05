// src/server/project.ts
var ANSWER_SNIPPET_LIMIT = 400;
var QUESTION_SNIPPET_LIMIT = 800;
function contentText(content) {
  if (!Array.isArray(content)) return "";
  const parts = [];
  for (const block of content) {
    if (block === null || typeof block !== "object") continue;
    const b = block;
    if (b.type === "text" && typeof b.text === "string") parts.push(b.text);
    if (b.type === "tool-call") {
      const name2 = typeof b.name === "string" ? b.name : "tool";
      parts.push(`[${name2}]`);
    }
    if (b.type === "tool-result") parts.push(contentText(b.content));
  }
  return parts.filter((p) => p.trim() !== "").join("\n");
}
function textContent(content) {
  if (!Array.isArray(content)) return "";
  const parts = [];
  for (const block of content) {
    if (block === null || typeof block !== "object") continue;
    const b = block;
    if (b.type === "text" && typeof b.text === "string") parts.push(b.text);
  }
  return parts.filter((p) => p.trim() !== "").join("\n");
}
function snippet(text, limit) {
  const normalized = text.replace(/\s+\n/g, "\n").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit)}\u2026`;
}
function describeError(value) {
  if (typeof value === "string") return value.trim() || null;
  if (value === null || value === void 0 || typeof value !== "object") return null;
  const v = value;
  const name2 = typeof v.name === "string" ? v.name : "";
  const message = typeof v.message === "string" ? v.message : "";
  return [name2, message].filter(Boolean).join(": ") || null;
}
function buildTurns(log) {
  const inherited = Number.isSafeInteger(log.inheritedEventCount) ? log.inheritedEventCount : 0;
  const turns = [];
  let current = null;
  for (const event of log.events ?? []) {
    if (!event || typeof event.type !== "string") continue;
    if (Number.isSafeInteger(event.seq) && event.seq < inherited) continue;
    const data = event.data ?? {};
    if (event.type === "user/message") {
      const kind = data?.source?.kind;
      if (kind !== "user") continue;
      const text = contentText(data?.content);
      if (text.trim() === "") continue;
      current = {
        startSeq: event.seq,
        messageId: typeof data?.id === "string" ? data.id : null,
        time: typeof event.time === "number" ? event.time : 0,
        question: snippet(text, QUESTION_SNIPPET_LIMIT),
        answerParts: [],
        tools: [],
        pendingCalls: /* @__PURE__ */ new Map(),
        todoCount: 0,
        status: "ok",
        approvals: [],
        pendingApprovalIds: /* @__PURE__ */ new Map()
      };
      turns.push(current);
      continue;
    }
    if (current === null) continue;
    switch (event.type) {
      case "assistant/message": {
        const text = textContent(data?.message?.content);
        if (text.trim() !== "") current.answerParts.push(text);
        break;
      }
      case "tool/call": {
        const callId = typeof data?.callId === "string" || typeof data?.callId === "number" ? String(data.callId) : null;
        const name2 = typeof data?.name === "string" ? data.name : "tool";
        if (callId !== null) {
          const idx = current.pendingCalls.get(callId);
          if (idx !== void 0) {
            current.tools[idx] = { name: name2, ok: true };
            current.pendingCalls.set(callId, idx);
          } else {
            current.pendingCalls.set(callId, current.tools.length);
            current.tools.push({ name: name2, ok: true });
          }
        } else {
          current.tools.push({ name: name2, ok: true });
        }
        break;
      }
      case "tool/result": {
        const callId = data?.message?.source?.callId ?? data?.source?.callId;
        const key = typeof callId === "string" || typeof callId === "number" ? String(callId) : null;
        const ok = data?.message?.isError !== true && data?.isError !== true;
        const idx = key !== null ? current.pendingCalls.get(key) : void 0;
        if (idx !== void 0 && idx < current.tools.length) current.tools[idx] = { ...current.tools[idx], ok };
        else if (key !== null) current.pendingCalls.set(key, current.tools.push({ name: "tool", ok }) - 1);
        break;
      }
      case "todo/write": {
        if (Array.isArray(data?.todos)) current.todoCount = data.todos.length;
        break;
      }
      case "turn/end": {
        const reason = data?.reason;
        const kind = reason?.kind;
        if (kind === "error") {
          current.status = "error";
          const detail = describeError(reason?.error);
          if (detail !== null) current.answerParts.push(`Error: ${detail}`);
        } else if (kind === "cancelled" || kind === "canceled" || kind === "aborted") {
          current.status = "cancelled";
        }
        break;
      }
      case "approval/asked": {
        const id = typeof data?.id === "string" ? data.id : null;
        const toolName = typeof data?.toolName === "string" ? data.toolName : null;
        const index = current.approvals.push({ toolName, pending: true }) - 1;
        if (id !== null) current.pendingApprovalIds.set(id, index);
        break;
      }
      case "approval/decided": {
        const id = typeof data?.id === "string" ? data.id : null;
        const index = id !== null ? current.pendingApprovalIds.get(id) : void 0;
        if (index !== void 0 && index < current.approvals.length) {
          current.approvals[index] = { ...current.approvals[index], pending: false };
        }
        break;
      }
      default:
        break;
    }
  }
  return turns.map((turn) => ({
    startSeq: turn.startSeq,
    messageId: turn.messageId,
    time: turn.time,
    question: turn.question,
    answer: snippet(turn.answerParts.join("\n\n"), ANSWER_SNIPPET_LIMIT),
    tools: turn.tools,
    todoCount: turn.todoCount,
    status: turn.status,
    approvals: turn.approvals
  }));
}

// src/server/graph.ts
function buildGraph(inputs) {
  const archived = new Set(inputs.registry.archivedSessionIds);
  const nodes = [];
  const byId = /* @__PURE__ */ new Map();
  const workspaceOfSession = /* @__PURE__ */ new Map();
  const groups = [];
  const groupIds = [];
  const ungrouped = /* @__PURE__ */ new Map();
  for (const workspace of inputs.registry.workspaces) {
    const workspaceId = workspace.workspaceId ?? workspace.id;
    if (typeof workspaceId !== "string" || workspaceId === "") continue;
    for (const sessionId of workspace.sessionIds ?? []) {
      if (typeof sessionId === "string") workspaceOfSession.set(sessionId, workspace);
    }
    groups.push({ workspaceId, title: workspace.title ?? workspaceId, path: workspace.path ?? null });
    groupIds.push(workspaceId);
  }
  for (const record of inputs.records) {
    const header = record?.header;
    if (header === void 0) continue;
    const sessionId = header.id;
    if (typeof sessionId !== "string" || sessionId === "") continue;
    if (archived.has(sessionId)) continue;
    let workspaceId = null;
    const owned = workspaceOfSession.get(sessionId);
    if (owned !== void 0) {
      workspaceId = owned.workspaceId ?? owned.id ?? null;
    } else {
      const cwd = typeof header.cwd === "string" && header.cwd !== "" ? header.cwd : "(no workspace)";
      const bucketId = `cwd:${cwd}`;
      let bucket = ungrouped.get(bucketId);
      if (bucket === void 0) {
        bucket = { workspaceId: bucketId, title: cwd.split("/").filter(Boolean).at(-1) ?? cwd, path: header.cwd ?? null };
        ungrouped.set(bucketId, bucket);
        groups.push({ workspaceId: bucketId, title: bucket.title, path: bucket.path });
        groupIds.push(bucketId);
      }
      workspaceId = bucketId;
    }
    const node = {
      sessionId,
      parentSessionId: typeof header.parentSession === "string" && header.parentSession !== "" ? header.parentSession : null,
      title: inputs.titles.get(sessionId) ?? sessionId,
      workspaceId,
      cwd: typeof header.cwd === "string" ? header.cwd : null,
      origin: header.origin === "subagent" ? "subagent" : null,
      delegationDepth: Number.isSafeInteger(header.delegationDepth) ? header.delegationDepth : 0,
      isSeeded: header.isSeeded === true,
      createdAt: Number.isSafeInteger(header.createdAt) ? header.createdAt : 0
    };
    nodes.push(node);
    byId.set(sessionId, node);
  }
  const edges = [];
  for (const node of nodes) {
    if (node.parentSessionId !== null && byId.has(node.parentSessionId)) {
      edges.push({ from: node.parentSessionId, to: node.sessionId, kind: "fork" });
    }
  }
  return { workspaces: groups, nodes, edges };
}

// src/server/layout-store.ts
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
var MAX_LANES = 2e3;
var LayoutStore = class {
  root;
  cache = /* @__PURE__ */ new Map();
  constructor(dataDir) {
    if (typeof dataDir !== "string" || dataDir.length === 0) throw new Error("dsh-mapper: config.dataDir must be a non-empty path");
    this.root = join(dataDir, "layout");
  }
  /** Workspace ids come from the registry (uuids) or our cwd buckets
   * (`cwd:/path`); keep the file name inside the layout dir. */
  fileFor(workspaceId) {
    if (typeof workspaceId !== "string" || workspaceId.length === 0 || workspaceId.length > 200) return null;
    const safe = workspaceId.replace(/[^A-Za-z0-9._-]/g, "_");
    if (safe === "." || safe === "..") return null;
    return join(this.root, `${safe}.json`);
  }
  async get(workspaceId) {
    const cached = this.cache.get(workspaceId);
    if (cached !== void 0) return cached;
    const file = this.fileFor(workspaceId);
    if (file === null) return null;
    let doc;
    try {
      const parsed = JSON.parse(await readFile(file, "utf8"));
      const lanes = {};
      if (parsed && typeof parsed === "object" && parsed.lanes && typeof parsed.lanes === "object") {
        for (const [sessionId, offset] of Object.entries(parsed.lanes)) {
          const dx = Number(offset?.dx);
          const dy = Number(offset?.dy);
          if (typeof sessionId === "string" && sessionId.length <= 200 && Number.isFinite(dx) && Number.isFinite(dy) && Object.keys(lanes).length < MAX_LANES) {
            lanes[sessionId.slice(0, 200)] = { dx: Math.round(dx), dy: Math.round(dy) };
          }
        }
      }
      doc = { workspaceId, lanes, updatedAt: typeof parsed?.updatedAt === "string" ? parsed.updatedAt : void 0 };
    } catch {
      return null;
    }
    this.cache.set(workspaceId, doc);
    return doc;
  }
  async put(workspaceId, lanes) {
    const file = this.fileFor(workspaceId);
    if (file === null) throw new Error("\u975E\u6CD5\u5DE5\u4F5C\u533A id");
    const clean = {};
    for (const [sessionId, offset] of Object.entries(lanes ?? {})) {
      const dx = Number(offset?.dx);
      const dy = Number(offset?.dy);
      if (typeof sessionId === "string" && sessionId.length <= 200 && Number.isFinite(dx) && Number.isFinite(dy) && Object.keys(clean).length < MAX_LANES) {
        clean[sessionId.slice(0, 200)] = { dx: Math.round(dx), dy: Math.round(dy) };
      }
    }
    const doc = { workspaceId, lanes: clean, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    await mkdir(dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile(tmp, `${JSON.stringify(doc)}
`, "utf8");
    await rename(tmp, file);
    this.cache.set(workspaceId, doc);
    return doc;
  }
};

// src/index.ts
var name = "dsh-mapper";
var inject = ["webServer", "sessionQuery", "workspaceRegistry"];
var VERSION = "0.0.2";
function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}
var MAX_BODY_BYTES = 256 * 1024;
async function readJson(req) {
  const reqAny = req;
  const chunks = [];
  let length = 0;
  for await (const chunk of reqAny) {
    length += chunk.length;
    if (length > MAX_BODY_BYTES) throw new InputError("\u8BF7\u6C42\u5185\u5BB9\u8FC7\u5927");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new InputError("\u8BF7\u6C42\u4E0D\u662F\u6709\u6548 JSON");
  }
}
var InputError = class extends Error {
};
function hostAllowed(headers, trusted) {
  const raw = typeof headers?.host === "string" ? headers.host : "";
  const hostname = raw.replace(/:\d+$/, "").toLowerCase();
  return trusted.has(hostname);
}
function apply(ctx, config) {
  const dataDir = typeof config?.dataDir === "string" && config.dataDir.trim() !== "" ? config.dataDir : void 0;
  const layouts = dataDir !== void 0 ? new LayoutStore(dataDir) : null;
  const trusted = /* @__PURE__ */ new Set(["localhost", "127.0.0.1"]);
  if (Array.isArray(config?.trustedHosts)) {
    for (const host of config.trustedHosts) {
      if (typeof host === "string" && host.trim() !== "") trusted.add(host.trim().toLowerCase());
    }
  }
  const page = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>dsh-mapper</title></head><body><p>dsh-mapper is mounted. API: <a href="/mapper/api/graph">/mapper/api/graph</a></p></body></html>`;
  const fetchGraph = async () => {
    const records = await ctx.sessionQuery.listSessions();
    const ids = records.map((record) => record?.header?.id).filter((id) => typeof id === "string" && id !== "");
    let titles = /* @__PURE__ */ new Map();
    try {
      const results = await ctx.sessionQuery.readTitleSnapshots(ids);
      for (const result of results) {
        const observation = result?.status === "fulfilled" ? result.value : result;
        const title = observation?.title?.title;
        const id = observation?.session?.id ?? observation?.sessionId;
        if (typeof title === "string" && title !== "" && typeof id === "string") titles.set(id, title);
      }
    } catch {
      titles = /* @__PURE__ */ new Map();
    }
    const graph = buildGraph({
      records,
      titles,
      registry: {
        workspaces: ctx.workspaceRegistry.list(),
        archivedSessionIds: ctx.workspaceRegistry.archivedSessionIds
      }
    });
    return graph;
  };
  const fetchTurns = async (sessionId) => {
    if (!/^[A-Za-z0-9_-]+$/.test(sessionId)) throw new InputError("\u975E\u6CD5\u4F1A\u8BDD id");
    const log = await ctx.sessionQuery.readSession(sessionId);
    return { sessionId, turns: buildTurns(log) };
  };
  const api = async (req, res) => {
    if (!hostAllowed(req.headers, trusted)) return void sendJson(res, 403, { error: "\u4E0D\u88AB\u4FE1\u4EFB\u7684 Host" });
    const path = new URL(req.url ?? "/", "http://dsh.local").pathname;
    if (path === "/mapper/api/graph" && req.method === "GET") {
      return void sendJson(res, 200, await fetchGraph());
    }
    const turns = /^\/mapper\/api\/sessions\/([A-Za-z0-9_-]+)\/turns$/.exec(path);
    if (turns !== null && req.method === "GET") {
      return void sendJson(res, 200, await fetchTurns(turns[1]));
    }
    const layout = /^\/mapper\/api\/layout\/(.+)$/.exec(path);
    if (layout !== null && layouts !== null) {
      const workspaceId = decodeURIComponent(layout[1]);
      if (req.method === "GET") {
        const doc = await layouts.get(workspaceId);
        return void sendJson(res, 200, { layout: doc });
      }
      if (req.method === "PUT") {
        const body = await readJson(req);
        const doc = await layouts.put(workspaceId, body?.lanes);
        return void sendJson(res, 200, { layout: doc });
      }
    }
    return void sendJson(res, 404, { error: "\u63A5\u53E3\u4E0D\u5B58\u5728" });
  };
  ctx.effect(() => ctx.webServer.register({ kind: "exact", path: "/mapper", handler: (_req, res) => {
    res.writeHead(302, { location: "/mapper/" });
    res.end();
  } }), "dsh-mapper: redirect");
  ctx.effect(() => ctx.webServer.register({ kind: "exact", path: "/mapper/", handler: (_req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(page);
  } }), "dsh-mapper: page");
  ctx.effect(() => ctx.webServer.register({ kind: "exact", path: "/mapper/api/health", handler: (_req, res) => sendJson(res, 200, { ok: true, plugin: name, version: VERSION }) }), "dsh-mapper: health");
  ctx.effect(() => ctx.webServer.register({ kind: "prefix", path: "/mapper/api", handler: api }), "dsh-mapper: api");
}
export {
  apply,
  buildGraph,
  buildTurns,
  inject,
  name
};
