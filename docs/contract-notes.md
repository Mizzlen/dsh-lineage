# dsh-mapper 契约核对记录（T0.3）

> 核对日期：2026-10-04。目标版本：**DSH 0.2.0-rc.2**（npm `latest`，本机全局安装并已启动 web profile）。
> 核对方式：优先读取**本机已安装的目标版本源码/类型声明**（`/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/`，下称 `$DSH_PKG`），其次项目内文档 `docs/harness/`。
> 环境：node v26.10.0、pnpm 10.34.6、web profile 启动于 127.0.0.1:3080（token 鉴权，裸访问 401）。

## a. 槽位契约 ✅（以安装版 .d.ts 为准，优于运行时 inspect）

**`shell.overlay`** —— `$DSH_PKG/dsh-client-ui-layout/lib/types/client/index.d.ts` L85-88：

```ts
'shell.overlay': { kind: 'list'; scope: 'root' }
```

list、root scope、无 owner 专有 props。官方占用先例：`dsh-client-ui-workspace` 在此注册 rename 弹窗、stop-and-archive 确认框、row toast 三个条目（`SessionRenameDialogProps` 等均基于 `PropsRuntime<'shell.overlay'>`）。**全屏地图可作为并列 list 条目注册，D5 主方案成立，无需兜底。**

**`conversation.session.header.actions`** —— `$DSH_PKG/dsh-client-ui-conversation/lib/types/client/contract/slots.d.ts` L155-159：

```ts
'conversation.session.header.actions': { kind: 'list'; scope: 'session'; owner: ConversationHeaderActionOwnerProps }
// ConversationHeaderActionOwnerProps = { children?: never } —— 无 owner 专有值，
// 组件只收标准 session props（sessionId / useSession / useProjection 等，slots.md L84-97）。
```

注册模式 = slots.md L23-46 文档示例（`ctx.slots.inject(name, () => ctx.slots.register({name, id, order}, Comp))`）。

**附带收获（M1/M3 直接可用）**：`sidebar.workspaces.session.menu.item`（会话行 "…" 菜单，官方条目 pin=100/rename=200/fork=300/archive=400，插件条目按 `order` 并列）；归档集合在 client 侧有现成注入形态 `hooks: { archived: HostObservable<ReadonlySet<SessionId>> }`（`ArchiveSessionInjected`）。

## b. `ctx.sessionQuery` ✅

服务表：`capability-seams.md` L132/L376-377/L620（`session-query` + `session-query-sqlite` → `svc_sessionQuery`）；web profile 已含 `dsh-session-query-sqlite` 行（`dsh --profile web --dump-config` 确认）。方法全集（`$DSH_PKG/dsh-session-query/README.md` L34-43）：

- `listSessions()` — 全量逻辑会话，newest-first，带 `live`/`persisted` 可用性标志（轻量）
- `readSession(id)` — **完整 raw 日志重放验证**（重；README L152 明示大历史每次全量付成本）
- `traceSession(id)` — 祖先链 + 递归后代树（地图父子边数据源）；一次性读，遍历 corpus 一遍
- `filterSessions(filters)` / `listEvents(id)` / `readSurface(id)` / `readEvent(request)` / `readTitleSnapshots(ids)` / `searchSessions` / `searchEvents` / `observeSession`
- 无 body 记录只带 `SessionHeader.isSeeded`；带 body 的读携带精确 `inheritedEventCount`（区分 fork 继承/自有事件，无需从日志推断切点）

**M1 设计约束**：卡片内容读取优先 `listEvents`/`readSurface`（轻量 fold），仅详情视图用 `readSession`；graph 组装用 `listSessions` + `traceSession`。

## c. `ctx.workspaceRegistry`（归档/置顶集合）✅

`capability-seams.md` L131（`workspace` 包 → `svc_workspaceRegistry`）；`$DSH_PKG/dsh-workspace/README.md` L116：

> registry 打开 `workspace` domain（version 2）：`workspaces` 表 + 全局状态持有 `workspaceIds`（权威显示顺序）、**`archivedSessionIds`**、`pinnedSessionIds`、可选 `defaultWorkspaceId`、可选 `pendingMutation`。

另有 `archiveSession(sessionId[, {stopActivity:true}])` API（L101，活动瀑布检查）。**M1 归档过滤 = server 侧读 registry 的 `archivedSessionIds`。**

## d. 持久化事件类型枚举 ✅

权威目录 `docs/harness/persistence-catalog.md`（surface 事件全集，2026-10-04 摘录）：`user/message`、`assistant/message`、`assistant/attempt`、`tool/call`、`tool/result`、`tool/ptc-dispatch(.-start)`、`tool-workflow/*`、`todo/write`、`turn/start`、`turn/end`、`step/start`、`step/end`、`session/title`、`session/title-llm-request`、`session/end-seed`（log-only fork 切点）、`approval/asked`、`approval/decided`、`approval/policy`、`command/run`、`command/done`、`system/message`、`developer/message`、`request/context`、`request/header`、`compaction/*`、`subagent/catalog`、`subagent/descriptor`、`team/*`、`feedback/*`、`hook/*`、`llm/retry*`、`model/selection`、`plan/mode`、`sandbox/mode`、`image/offload`、`deliverables/presented`、`agent-preset/selected`、`agent/inbox/spliced`、`schedule/change`、`goal/change`、`session-log-deepseek/delivery-accepted`。

**T1.3 白名单草案**：卡片相关 = `user/message`（剔 `source.kind==='plugin'`）、`assistant/message`、`tool/call`、`tool/result`、`todo/write`、`turn/start`、`turn/end`（error/cancel 态）、`session/title`、`approval/asked`、`approval/decided`、`command/run`、`command/done`；其余一律忽略。

## e. 客户端构建（clientBundle 预设不可得 → 自研等价）✅

`docs/harness/cookbook/adding-a-settings-card.md` L60 原文：**`clientBundle` tsdown 预设位于 monorepo `packages/client/tsdown.client.ts`，不在任何已发布的包里，仓库之外的包要自己复刻这一步构建。**

从安装版官方 bundle `$DSH_PKG/dsh-client-ui-settings-web-search/lib/client.js` 提取的 factory 形态（0.2.0-rc.2 实测）：

```js
window.__ModuleLoader__.load({
  id: "<包名>",
  factory: (require) => {          // require = loader 模块表（react/jsx-runtime、其他 dsh client 包运行时解析）
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    /* …CJS bundle… */
    exports.apply = apply; exports.inject = inject;
    return module.exports;
  }
});
```

模块级导出契约：`inject`（服务名数组，如 `['slots']`）+ `apply(ctx)`；`slots` 服务由 `dsh-client-ui-renderer` 构造（其 lib/client.js `super(ctx, "slots")`）。manifest 模板参照 web-search 包的 `dsh.client` 声明。

**dsh-mapper 等价构建**（scripts/build.mjs）：esbuild `--format=cjs --bundle --platform=browser`，external = `react*` 与 `@deepseek-ai/*`（走 loader require），产物包裹进上述 factory；构建后断言产物含精确包名与 `__ModuleLoader__.load`。

## 附：其他运行时事实

- `webServer` 服务由 `dsh-host-webserver` 提供（安装版 grep 确认），`ctx.webServer.register({kind:'exact'|'prefix', path, handler})`（docs `subsystems/web-server.md` L17-25；synapse 先例；T0.4 运行时验证）。
- web profile 组成（dump-config 摘录）：`dsh-api-gateway`、`dsh-session`、`dsh-session-persistence-jsonl`、`dsh-session-query-sqlite`、`dsh-storage(-json/-domain)`、`dsh-hmr` 等——本插件依赖的服务行全部在栈内。
- `cordis_inspect_*` 是 DSH agent 创造模式工具（`tool-catalog.md` L731-746），非 CLI；槽位核对以安装版 `.d.ts` 为准（等效且更精确）。

## M1 运行时实测补充（2026-10-04，真实日志验证）

1. **事件 data 的真实形状与类型面有出入，以实测为准**：
   - `assistant/message` data = `{ turn, step, message: { role, content, source, id }, usage, stream }`——正文在 **`data.message.content`**（含 `{type:'reasoning'}` 思考块，投影答案时必须排除，只取 `{type:'text'}`）；
   - `tool/result` data = `{ turn, step, message: { role:'tool', content, source:{kind:'tool', callId}, isError? }, meta }`——callId 在 **`data.message.source.callId`**；
   - `tool/call` data = `{ turn, step, callId, name, arguments }`（arguments 是 JSON 字符串）；
   - `turn/end` data = `{ turn, reason: { kind } }`，kind 实测 `completed`（文档另有 error/cancelled）；
   - `user/message` data = `{ content, source: { kind:'user', rpcId, clientTimeZone }, role, id }`——`source.kind !== 'user'` 的注入（system-reminder 等）投影时剔除，实测 0 泄漏。
2. **registration inject 的 hooks 通道在此版本不可用**：`register(meta, comp)` 的 meta.inject 返回 `{ hooks: { open: source } }` 时条目被静默丢弃（无报错、无 fiber）。可行替代：inject 返回稳定自定义 hook 函数作为普通 callback 成员（组件内 `useState`+`subscribe`），实测渲染正常。官方 ui-workspace 条目均通过宿主 SlotHookFactory 注入 hook，独立插件目前应走自定义 hook。
3. **真实语料规模参考**：本机 9 会话（5 标题 + 4 空白），最大会话 320 事件/5 轮/38 步；`readSession` 单会话毫秒级，graph 接口全量 3.4KB，turns 接口按会话 2-3KB——M1 无需缓存层。
4. **会话日志落盘为 `session.v4.jsonl.zstd`**（zstd 压缩，Node 内置 `zlib.zstdDecompressSync` 可读），调试时可直接解包。
