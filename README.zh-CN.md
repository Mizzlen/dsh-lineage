# dsh-mapper 会话地图

[English](README.md) | 中文

DeepSeek Harness 的可视化会话地图插件：把同一工作区下的会话、追问与 fork 分支摆上同一张可缩放、可拖拽的画布。

**DSH 原生会话日志是唯一事实源**——本插件只按需读取（`ctx.sessionQuery`），除了泳道拖拽偏移这类视图元数据外不落盘任何内容；不改 prompt、工具 schema、provider 路由，也不影响 KV-cache。

## 功能（v0.0.2）

- **会话中心视角**：从某会话点开地图，画面以该会话为中心，展示其血缘邻域（祖先链 + fork 后代），且严格隔离在其所属工作区内；一键「展开为工作区地图」上钻——**工作区是最高层级，没有再往上的聚合视图**。
- **只读地图**：泳道 = 会话（标题 + 运行中徽标），卡片 = 一轮问答（提问、回答摘要、工具 chips、失败计数、取消/出错徽标、待审批徽标），SVG 曲线 = fork 血缘边（来自会话头 `parentSession`）。
- **跳转**：点击卡片问题文字 → 关闭地图并打开原生对话、滚动定位到该轮。当前会话直通（不查侧栏）；其他会话经侧栏行桥（自动展开折叠列表、滚动虚拟列表），定位失败时明确降级。
- **追问**：泳道「追问」按钮就地输入，经会话 binding 的 `prompt(…, 'queue')` 发送（未实例化的会话自动物化）。
- **分支**：泳道「分支」= 从最近已完成轮 fork；卡片「⎇ 从此分支」= 从该轮精确切点 fork（`atSeq`）。
- **布局持久化**：拖拽泳道标题移动位置，偏移按工作区存到 `$DSH_HOME/dsh-mapper/layout/`（仅视图元数据）。
- **subagent 开关**：顶栏一键隐藏/显示委派子会话泳道。
- **实时状态**：会话列表/运行态来自标准 hooks；某会话运行结束自动失效其卡片缓存并刷新。
- 滚轮缩放、Shift/Alt+滚轮与拖拽平移、双击复位（会话视角复位=重新居中）。

## 兼容性

- DeepSeek Harness **0.2.0-rc.2**（`web` profile；契约经安装版 `.d.ts` 与真实会话日志核验，见 `docs/contract-notes.md`）。
- Node.js >= 22.19.0。

## 安装 / 验证

```sh
dsh plugin --profile web add ./
dsh --profile web --dump-config   # 应出现 dsh-mapper 层
dsh --profile web
```

打开任意会话 → header 上的「会话地图」按钮 → 地图全屏展开。Host API：`GET /mapper/api/graph`、`GET /mapper/api/sessions/:id/turns`、`GET|PUT /mapper/api/layout/:workspaceId`、`GET /mapper/api/health`。

## 配置（cordis.patch.yml）

| 字段 | 默认 | 说明 |
|---|---|---|
| `dataDir` | `$DSH_HOME/dsh-mapper` | 泳道偏移存储目录（仅视图元数据） |
| `trustedHosts` | `[]` | 额外放行的 Host 名（localhost 恒放行），用于反向代理部署 |

## 禁用 / 卸载

`dsh plugin --profile web remove dsh-mapper`。卸载后留下的只有 `$DSH_HOME/dsh-mapper/`（偏移数据），删除即可彻底清理；会话数据无任何影响。

## 已知边界

- 跳转依赖侧栏行标题匹配与 chat 锚点 DOM 前缀（`data-chat-anchor-key`），属于版本敏感的兼容桥，失败时有明确降级提示（`src/client/glue.ts` 集中收口）。
- 「追问」要求该会话已在客户端实例化过（binding 存在）；未实例化时提示先在原生对话打开一次。
- 未做：minimap、synapse 旧数据导入、设置卡片（配置走 patch 文件）。

## License

MIT — 见 [LICENSE](LICENSE)。理念启发自 dsh-synapse (MIT) © liangmianya；实现独立、无代码共享。
