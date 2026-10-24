# InkPoem Q0 合并后验收记录

日期：2026-10-24
验收基线：main ec7f49bcefc5d5f3a5a6f3659c8c29727d11b91e（PR #2、#3、#4 均已合并）
Q0 验收工作：[PR #6](https://github.com/mingzhangyang/poem-to-image/pull/6)

## 结论：自动化验收与外部门禁必须区分

- **原始合并代码 CI：PASS。** [main CI #40116404903](https://github.com/mingzhangyang/poem-to-image/actions/runs/40116404903)：32/32 Chromium 浏览器检查、62/62 Node/前端测试、26/26 Workers/D1 测试，TypeScript、Lint、构建、Wrangler deploy dry-run 和两项依赖审计均通过（审计报告 0 个漏洞）。
- **Q0 扩展自动化门禁：以 PR #6 最新 CI 为准。** 这次增加 9 种导出实文件验证、8 种语言界面与恢复、撤销/重做、模板持久化、游客 AI 门禁与首次访问引导。首次 CI #40122005417 中 36 通过、6 跳过、2 失败；失败均与验收测试前提有关：语言测试的 initScript 每次刷新重写英文，Chromium 原生文件保存选择器不会发出 Playwright download 事件。修正了测试脚本的前提，不把它们错误归因于生产功能。**本记录中的新增检查必须等更新后 CI 通过才算通过。**
- **生产部署门禁：未验证。** CI 只执行部署 dry-run，不能证明 Cloudflare 生产 Worker 已发布 main ec7f49b 或生产内容和响应头相符。当前没有可用的 Cloudflare 已认证控制台证据；站点无法被当前抓取工具访问，不等于线上站点故障。
- **真实 iOS Safari／Clerk／Stripe／独立 staging：未验证。** Playwright 的 mobile 项目是 Chromium 模拟设备，并非真实 iPhone Safari 中文输入法或真实 ClipboardItem；Workers/D1 是本地集成测试，并非真实 Stripe 测试模式支付及 staging D1。
- **生产扩量/商业化放行：暂不批准**，直到下列外部门禁有明确证据。本次验收不触发真实支付、付费 AI、生产部署、数据库修改或 PR 自动合并。

## Q0 问题清单

标记说明：MAIN PASS = 已有合并后成功 CI 证据；PR6 CHECK = 依赖 PR #6 最新运行结果；MANUAL = 无法用当前工具和模拟浏览器替代真实设备或环境。

| 修复项 | 验证状态与证据 | 尚需确认 |
| --- | --- | --- |
| MAJOR-1：编辑器快速输入及失焦 | MAIN PASS：快速输入 50 字以上标题、多字节中文插入，断言焦点及弹窗保留 | MANUAL：持续一分钟实键盘输入、中文 IME 组合输入（桌面和 iPhone） |
| MAJOR-2：匿名复制图片 | MAIN PASS：测试真实 PNG 魔数及非空剪贴板数据，缺失/拒绝 Clipboard API 时真实 PNG 下载；320×480 导出抽屉可滚动 | MANUAL：iOS Safari 原生剪贴板授权、粘贴至备忘录和下载体验 |
| MINOR-1：缩放滑块读数 | MAIN PASS：100% 到 200% 对应滑块值 | 真实手机/桌面视觉缩放感受 |
| MINOR-2/3：简繁文字及英文 AI 提示词说明 | MAIN PASS：八语言键完整性与翻译测试，AI 英文建议有翻译说明 | MANUAL：母语审阅、跨控件长文本与中文输入法 |
| MINOR-4：Canvas Size 全量本地化 | MAIN PASS：八语言键校验；PR6 CHECK：八语言真实控件与分组文本、刷新恢复 | 实际手机布局、语言专业审校 |
| MINOR-5：撤销尺寸同时恢复预设标签 | MAIN PASS：undo 与旧 ID 刷新恢复；PR6 CHECK：undo → redo → reload | 无特定付费门禁 |
| MINOR-6：About 技术支持与积分说明 | MAIN PASS：About 路由烟测、语言包源码检查 | 生产实际页面内容与布局 |
| MINOR-7：清空标题不留过期识别 | MAIN PASS：清空标题立即隐藏旧匹配，随后仅改正文仍可重新识别 | 实键盘操作 |
| MINOR-8：导出文件名 | MAIN PASS：清洗非法字符、UTF-8 长中文限制、批量预设后缀、无标题回退；PR6 CHECK：PNG/JPG/WebP × 1x/2x/3x 的真实文件头、像素、文件名 | 生产浏览器文件保存和 iOS 文件下载 |
| MINOR-9：首次访问引导 | MAIN PASS：源码包含多语言 CTA；PR6 CHECK：320px 和 1440px 首访真实点击并进入编辑器 | 真实 iOS 导航、读屏 |
| 语言、模板、画布及诗歌跨刷新恢复 | MAIN PASS：标题正文与预设刷新测试；PR6 CHECK：内置模板 ID／背景文件、正文、尺寸与语言恢复 | 真机持久化，储存容量和浏览器隐私模式 |
| Guest AI 安全 | MAIN PASS：Workers 认证边界；PR6 CHECK：游客 AI 按钮禁用且零付费 API 请求 | staging 测试账号的真实认证流程 |
| /about、/privacy、/account 页面 | MAIN PASS：本地 Vite 页面烟测 | 线上 Worker 深链接 HTTP 状态、内容及响应头 |
| 计费、D1、退款和对账 | MAIN PASS：26 个本地 Worker/D1 测试 | MANUAL STAGING：隔离 D1、Clerk/Stripe 测试模式、重试幂等、对账和回滚 |

## 外部完成门禁

1. **生产部署/响应验证：** 在 Cloudflare 读取 Worker 版本和部署时间，并与批准的 main SHA 对照。逐一检查 /、/about、/privacy、/account、静态资源、API 404、缓存和安全响应头，查看 5xx/错误日志。GitHub 的 merge 和 deploy dry-run 不能替代这一证据。
2. **真实独立 staging：** staging Wrangler 配置须使用独立 D1、Clerk 测试应用、Stripe 测试密钥和 webhook secret。演练迁移、只读对账查询及 D1 时间点恢复证据；不能借用生产 D1。
3. **支付链路（仅测试模式）：** 模拟 Checkout 完成，验签 webhook 并重复投递，证实同一订单只发放一次积分；测试失败请求、不足余额、补偿、待处理订单和退款政策。禁止真实收费或真实付费 AI 请求。
4. **iPhone Safari 实机：** 一分钟英文/中文 IME 连续编辑；模板→撤销→重做→刷新；复制图像粘贴到系统 App；拒绝剪贴板时实际下载 PNG；检查小屏滚动、焦点、9 种导出尺寸中代表性格式。
5. **运维、法务与语言验收：** 检查告警接收方、对账异常、回滚版本和 D1 恢复书签，确认退款、隐私政策及母语翻译审查签署。

## 发现：文档的 Cron 执行频率与实际配置不一致

- 当前生产配置 wrangler.jsonc：0 * * * *，**每小时检查一次**。
- staging 示例 wrangler.staging.example.jsonc：*/15 * * * *，**每 15 分钟一次**。
- 旧 operations-runbook.md 一律写“每 15 分钟”，有误导风险。PR #6 修订说明，**不修改 Worker 的实际触发器**。若必须做到生产 15 分钟故障检测 SLA，应另开运维变更并验证 Cloudflare 的真实触发器和告警。

## Q0 退出条件

1. PR #6 上更新后的 verify、browser-smoke 均成功，新引入的 review threads 处理完毕后，才能宣告**自动化 Q0 验收通过**。保持 PR 开放直到人工审阅，不能自动合并。
2. 若无法核实真实 Cloudflare 生产版本、隔离 staging 账单流程、iOS Safari 实机，请保留为**未验证**，不得写“Q0 全量通过”或“生产已发布”。
3. 下一阶段只修复经验证的真实用户缺陷。不要为了 Q0 新建社交画廊、分享链接存储或付费 AI 功能。
