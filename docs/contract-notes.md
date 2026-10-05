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

## M2/M3 运行时实测补充（2026-10-04，浏览器端到端验证）

1. **client 服务清单**（`reflect.provide` 实测）：`sessions`、`layout`、`modules`、`pluginNavigation`、`sidebarRight(Tabs)`、`documentPreviews`、`resources`、`uiRenderer`、`userQuestionPanels`。**没有 workspaces 服务，也没有任何「切换当前会话视图」的公开 API**（`service.d.ts` L85 明示 view selection 在 Controller 之外）——跳转只能走 DOM 桥，见下。
2. **`sessions` 服务可用面**（api-session-controller）：`create/fork({sessionId, atSeq, increaseTitle})/binding(id)/using(target,{source},op)/retain`；`binding(id).session.prompt(content,'queue')` 发消息。会话未实例化时 `binding` 为 undefined，可用 `using(id, {source:'mainView'}, …)` 按侧栏同款方式物化（原生代码实测 `source: "sidebarView"/"mainView"`）。
3. **原生对话的轮次锚点**：chat DOM 渲染 `data-chat-anchor-key="<表面节点索引>:input-message<完整消息uuid>"`——**前缀不是事件 seq**（同一会话 8 条 user 消息全是 `13:`），稳定句柄是消息 uuid。`TurnDTO.messageId` 取自 `user/message` 事件的 `data.id`，定位选择器 `[data-chat-anchor-key$="input-message<uuid>"]`。
4. **侧栏行匹配**：treeitem 无 aria-label，textContent = `标题+相对时间` 且**无空格**（"介绍 otty 工具1h"）；会存成 accessible name 时拼 "…Session actions for …"。行匹配必须剥掉 chrome 后整等，且 fork 行标题含 " (1)"，原会话与 fork 靠整等区分。列表截断时需点 "Show N more sessions" 展开。
5. **追问后的卡片回流**：`prompt` 接受（`{accepted:true}`）≠ 已完成；地图侧需要两条刷新路径——`useSessions` 的 running 翻转（true→false）触发该会话 turns 重拉 + 发送成功后定时（4s/12s）回拉。只失效缓存不触发拉取是无效的（M2 实测踩坑）。
6. **画布布局必须两遍实测**：卡片自然高度（~150px）远大于估算（114px），估算法在 fork 树上必然重叠；渲染后 `useLayoutEffect` 量 `offsetHeight` 回灌重排一遍即收敛。视口剔除与测量互相饿死（未渲染的泳道永远量不到），当前语料规模下全量渲染 + 实测是正确取舍。
7. **`shell.overlay` 的 hooks 通道不可用而普通 callback 成员可用**（M1 已记）——稳定自定义 hook（useState+subscribe）作为 inject 成员传入，React 视角是普通 hook，实测可靠。

## v0.0.4 运行时实测补充（2026-10-05）

1. **fork 切点的权威来源是 `SessionLogSnapshot.inheritedEventCount`**（`dsh-session-query` types.d.ts L26-27）：`readSession` 返回顶层字段，`seedSeq = inheritedEventCount − 1` 恰好等于 fork 请求的 `atSeq`（包含式切点）。无需扫 `session/end-seed` 事件。
2. **`sessions.fork`（ClientSessions 门面）返回 childId 字符串**，不是 manager 层的 RemoteResult；`increaseTitle: true` 由门面在 fork 后对 **child** 追加一次 user 改名（"标题 (N)"，日志可见 seq 147/149/151 连续 (1)(2)(3) 均为 child 上的激活重名痕迹）。失败抛 `SessionForkError`。
3. **Host 侧 rename 严格按 id 隔离**（源码核验 + 实测）：`resolveAgent(sessionId)` → `resumeObserved` 在 `observation.header.id !== sessionId` 时直接抛 `ApiSessionNotFound`；`AgentRegistry.enter` 要求 `agent.id === agent.session.id`；`sessionTitle.rename(session, …)` 只向 `session.id` 的日志追加 `session/title`（source=user，且会 supersede 在飞的 LLM 自动命名并 pin 标题）。**给懒分支存根改名（PUT /mapper/api/branches/:id）只写 branch-store JSON，父会话标题事件纹丝不动**——2026-10-05 浏览器端到端实测确认。
4. **web profile 宿主进程启动时加载 lib/index.js，之后不随文件变化热更**：改服务端代码后必须重启 `dsh --profile web`；client bundle（lib/client.js）则是每次页面刷新现取的。排查"接口字段缺失"时先分辨这两侧。
5. **fork 子会话的工作区归属可能滞后于注册表**：新 fork 的 child 可能落进 cwd 桶（graph 的 workspaceId 为 `cwd:…`）而非父会话的注册表工作区，会话中心视角（工作区隔离）会暂时看不到它。属 v0.0.2 归属行为，非回归。
6. **画布图层渲染（2026-10-05）**：`.dshm-layer` 禁止常驻 `will-change: transform`——Chromium 对 will-change 图层冻结 raster scale，缩放只是纹理上采样（放大即糊）；去掉后每帧按当前 scale 重栅格化，文字/SVG 边保持矢量清晰。图层提升只在拖拽平移期间（`.is-panning`）临时恢复——平移不改变 raster scale。同批：`.dshm-overlay` 全局 `user-select:none`（阅读浮层与追问输入恢复 `text`），画布拖拽不再选走顶栏文本。
7. **BranchStore 缓存会复活绕过 API 的盘改（2026-10-05）**：宿主进程持有 branch-store 的内存 cache，直接编辑磁盘 JSON 后，任何一次经 API 的写入（如 create）都会把 cache 里的旧数据整份 persist 回盘。清理存根必须走 `DELETE /mapper/api/branches/:id`（或先停宿主再改盘）。
8. **侧栏行 chrome 的完整形态与折叠组（2026-10-05，v0.0.6 跳转修复）**：
   - 活动/刚结束会话的行文本 = `Completed` + 标题 + `now` **三段无分隔粘合**（"Completed标题now"）——安全剥离（Session actions 尾巴 + 数字时间）剥不掉，父子互跳因此整等失败；跳转桥改为两段式：安全剥离整等失败后再用激进剥离（状态词前缀 `completed|running|errored|…` + 尾部 `now`）整等。
   - fork 子会话可能落在侧栏 **"Ungrouped" 组**（cwd 桶归属），该组默认折叠——折叠组的行不在 DOM 上，只扫 `[role="treeitem"]` 永远找不到。桥在匹配失败时先点击所有 `[role="treeitem"][aria-expanded="false"]` 展开组再重扫。两者合起来修复"从父进入点子 / 从子进入点父都报找不到会话"。
   - **行文案随账号语言双语**（2026-10-05 用户日志确认，zh UI）：zh 行尾粘 `6分钟`/`18小时`（无空格），组行叫 `默认工作区`/`未分组`——en 规则（`16h`/`now`）完全失效。剥离函数提升为导出纯函数 `stripRowChrome`/`stripRowChromeAggressive`（glue.ts），双语时间与状态词均有单测（test/glue.test.ts，用用户日志原文做用例）。诊断钩子：失败时挂 `window.__dshmJumpDebug`（wanted/行数/折叠组数/全部行文本）并 console.warn，toast 指向它。

## Desktop（Electron）安装实测（2026-10-04）

- Desktop = `/Applications/DeepSeek Harness.app`，与 CLI **共用 `~/.dsh`**（同一 sessions/storages），启动 `~/.dsh/profiles/desktop`（bundle 栈 = `dsh-base` + `dsh-web-app`），内嵌同一套 web 栈并监听 `127.0.0.1:19387`（带与 web 相同的 token 鉴权 fence）。
- `dsh plugin --profile desktop …` 被拒：`profile "desktop" is managed exclusively by the Electron application`。
- **手工安装（改 package.json bundles/deps + node_modules 软链）会让 desktop host 启动挂起**：只要 profile 目录里存在 `node_modules`（完整 pnpm install 或裸 symlink 均复现），host 进程起得来但永不监听端口；移除 node_modules 后立即恢复。仅改 manifest（无 node_modules）能正常启动但行无法解析、被静默忽略（路由 404）。
- 结论：Desktop 的受支持安装路径是**应用内**的 Plugins 页（或 creator 模式 agent 的 `plugin_manager` 工具），由应用自己的 reconciler 处理依赖。dsh-mapper 尚未装入 desktop；待用户走应用内流程。
- 注意：Desktop renderer 若经 `dsh-app://` scheme 发起 fetch，Host 头可能不是 localhost——届时把实际 host 加进 cordis.patch.yml 的 `trustedHosts` 即可（配置已预留）。
