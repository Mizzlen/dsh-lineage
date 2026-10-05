# dsh-mapper 会话地图

[English](README.md) | 中文

DeepSeek Harness 的可视化会话地图插件：把同一工作区下的会话、追问与 fork 分支摆上同一张可缩放、可拖拽的画布。

**DSH 原生会话日志是唯一事实源**——本插件只按需读取（`ctx.sessionQuery`），除了泳道拖拽偏移、分支存根这类视图元数据外不落盘任何内容；不改 prompt、工具 schema、provider 路由，也不影响 KV-cache。

## 功能（v0.0.6）

- **会话中心视角**：从某会话点开地图，画面以该会话为中心，展示其血缘邻域（祖先链 + fork 后代），且严格隔离在其所属工作区内；一键「展开为工作区地图」上钻——**工作区是最高层级，没有再往上的聚合视图**。
- **泳道标题三合一**：单击标题打开该会话、双击改名（存根则改分支名）、拖拽移动泳道。
- **追问卡片**：每条泳道的卡片队列**尾部常驻一张追问卡——整个卡片就是一个输入框**（Enter 发送，Shift+Enter 换行，随内容增高）；消息卡片不再设追问按钮，**对中间某轮的"追问"走该卡片右缘的「>」分支**。存根泳道只有这一张追问卡：第一次追问即 fork 出真会话并发送。
- **卡片交互**：单击问题文字跳转原生对话的那一轮；**双击卡片背景展开阅读**——卡片上浮至前景中心、背景压暗，浮层内滚轮只滚正文；**右缘圆形「>」=「从此分支」**，fork 连线即从此按钮引出、直连对应轮次卡片。
- **轮次锚定的分支边**：存根记录创建时的切点——**该轮 `turn/end` 事件处，即子会话继承"问题+回答+工具"的完整一轮**（对应地图上从该卡片引出的边）；已物化的 fork 会话经日志继承前缀长度（`inheritedEventCount`）解析切点，两种来源的边都从切点卡片的「>」按钮位置出发，而非泳道标题条。
- **懒分支**：点「>」只记录存根（虚线 ◇ 泳道，标题栏 ✕ 删除、双击改名），**不创建会话**。存根只是 `$DSH_HOME/dsh-mapper/branches/` 里的视图元数据，对任何 DSH 会话零影响。
- **只读地图**：泳道 = 会话（标题 + 运行中徽标），卡片 = 一轮问答（提问、回答摘要、工具 chips、失败计数、取消/出错徽标、待审批徽标），SVG 曲线 = fork 血缘边。
- **跳转**：父子会话互跳可靠可用——跳转桥会展开折叠的工作区分组、处理截断列表与虚拟列表、剥离行上粘合的状态/时间 chrome（含活动行的 "Completed…now"）后精确匹配，区分同名 fork，失败时明确降级。
- **布局持久化**：拖拽泳道标题移动位置，偏移按工作区存到 `$DSH_HOME/dsh-mapper/layout/`（仅视图元数据）。
- **subagent 开关**：顶栏一键隐藏/显示委派子会话泳道；macOS 下顶栏自动避开窗口红绿灯。
- **实时状态**：会话列表/运行态来自标准 hooks；某会话运行结束自动失效其卡片缓存并刷新。
- 滚轮缩放、Shift/Alt+滚轮与拖拽平移、双击空白复位（会话视角复位=重新居中）；地图内拖拽不会选走任何文本，放大始终保持矢量清晰。

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
