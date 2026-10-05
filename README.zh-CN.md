# dsh-lineage 会话地图

[![dsh.pub registry status](https://dsh.pub/api/badges/Mizzlen/dsh-lineage.svg)](https://dsh.pub/en/plugins/?q=Mizzlen%2Fdsh-lineage)

[English](README.md) | 中文

DeepSeek Harness 的可视化会话地图插件：把同一工作区下的会话、追问与 fork 分支摆上同一张可缩放、可拖拽的画布。

**DSH 原生会话日志是唯一事实源**——本插件只按需读取（`ctx.sessionQuery`），除了泳道拖拽偏移、分支存根这类视图元数据外不落盘任何内容；不改 prompt、工具 schema、provider 路由，也不影响 KV-cache。

## 功能（v0.1.0）

- **血缘图（默认视角）**：由根会话层层分支产生的一棵树就是**同一张地图**——从任一成员打开，看到的都是**根会话的整棵树**：祖先链、祖先的其他分支、自己的全部后代，一个不漏。血缘关系由 `parentSessionId` 定义，**内部不做任何工作区隔断**（fork 落进 cwd 分组的子会话依然是同一棵树）；在树内任何泳道上添加分支都立即出现在同一张图里，任意祖先 ↔ 任意后代一对点击互跳。
- **工作区视角（上钻）**：一键展开为工作区的扁平会话切片——与 DSH 原生管理结构对齐的那一层。
- **泳道标题三合一**：单击标题打开该会话、双击改名（存根则改分支名）、拖拽移动泳道。
- **追问卡片**：每条泳道的卡片队列**尾部常驻一张追问卡——整个卡片就是一个输入框**（Enter 发送，Shift+Enter 换行，随内容增高）；消息卡片不再设追问按钮，**对中间某轮的"追问"走该卡片右缘的「>」分支**。存根泳道只有这一张追问卡：第一次追问即 fork 出真会话并发送。
- **卡片交互**：单击问题文字跳转原生对话的那一轮；**双击卡片背景展开阅读**——卡片上浮至前景中心、背景压暗，浮层内滚轮只滚正文；**右缘圆形「>」=「从此分支」**，fork 连线即从此按钮引出、直连对应轮次卡片。
- **上下文继承对应地图边**：分支切点 = 该轮 `turn/end`——子会话继承"问题+回答+工具"的**完整一轮**，追问卡的话作为下一轮用户消息；已物化的 fork 会话经日志继承前缀长度（`inheritedEventCount`）解析切点，两种来源的边都从切点卡片的「>」按钮位置出发。
- **跳转生命周期**：跳转桥带取消令牌——关闭地图或发起新跳转会取消在飞的桥操作（重试、滚动、行点击），不再滞留到之后误触切换；失败时 `__dshmJumpDebug` 输出完整行文案证据。
- **懒分支**：点「>」只记录存根（虚线 ◇ 泳道，标题栏 ✕ 删除、双击改名），**不创建会话**。存根只是 `$DSH_HOME/dsh-lineage/branches/` 里的视图元数据，对任何 DSH 会话零影响。
- **只读地图**：泳道 = 会话（标题 + 运行中徽标），卡片 = 一轮问答（提问、回答摘要、工具 chips、失败计数、取消/出错徽标、待审批徽标），SVG 曲线 = fork 血缘边。
- **布局持久化**：拖拽泳道标题移动位置，偏移按工作区存到 `$DSH_HOME/dsh-lineage/layout/`（仅视图元数据）。
- **subagent 开关**：顶栏一键隐藏/显示委派子会话泳道；macOS 下顶栏自动避开窗口红绿灯。
- **实时状态**：会话列表/运行态来自标准 hooks；某会话运行结束自动失效其卡片缓存并刷新。
- 滚轮缩放、Shift/Alt+滚轮与拖拽平移、双击空白复位；地图内拖拽不会选走任何文本，放大始终保持矢量清晰。

## 兼容性

- DeepSeek Harness **0.2.0-rc.2**（`web` profile；契约经安装版 `.d.ts` 与真实会话日志核验，见 `docs/contract-notes.md`）。
- Node.js >= 22.19.0。

## 安装 / 验证

```sh
dsh plugin --profile web add ./
dsh --profile web --dump-config   # 应出现 dsh-lineage 层
dsh --profile web
```

打开任意会话 → header 上的「会话地图」按钮 → 地图全屏展开。Host API：`GET /lineage/api/graph`、`GET /lineage/api/sessions/:id/turns`、`GET|PUT /lineage/api/layout/:workspaceId`、`GET /lineage/api/health`。

## 配置（cordis.patch.yml）

| 字段 | 默认 | 说明 |
|---|---|---|
| `dataDir` | `$DSH_HOME/dsh-lineage` | 泳道偏移存储目录（仅视图元数据） |
| `trustedHosts` | `[]` | 额外放行的 Host 名（localhost 恒放行），用于反向代理部署 |

## 禁用 / 卸载

`dsh plugin --profile web remove dsh-lineage`。卸载后留下的只有 `$DSH_HOME/dsh-lineage/`（偏移数据），删除即可彻底清理；会话数据无任何影响。

## 已知边界

- 跳转桥依赖原生侧栏的 DOM 结构（行的标题叶子、chat 锚点 `data-chat-anchor-key`），属于版本敏感的兼容桥；匹配分三段（标题叶子精确 → 组合串安全剥离 → 激进剥离），失败时在控制台输出 `__dshmJumpDebug` 完整证据并明确降级（`src/client/glue.ts` 集中收口）。
- 对「运行中」的轮次点「从此分支」时该轮尚无 `turn/end`，切点回退到该轮提问处（子会话不含该轮未完成的回答）。
- 未做：minimap、synapse 旧数据导入、设置卡片（配置走 patch 文件）。

## 发布状态

已按 [dsh.pub 的插件开发与收录指南](https://dsh.pub/develop-plugin.md) 准备：仓库根即独立可安装包、预构建产物入库、`dsh.bundle.patch` 声明安全、CI 含构建/测试/产物契约检查与 web profile 激活冒烟。dsh.pub 的收录由自动化门禁与提交 PR 完成，**不代表任何人工评审、安全审计、兼容性认证或 DeepSeek 官方背书**。

## License

MIT — 见 [LICENSE](LICENSE)。理念启发自 dsh-synapse (MIT) © liangmianya；实现独立、无代码共享。
