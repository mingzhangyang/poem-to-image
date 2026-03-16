# AI 生图付费实现清单

## 目标

为 AI 生图能力增加可控的商业化链路，支持：

1. 用户登录
2. 购买积分
3. 查询余额
4. 生图前校验余额
5. 生图成功后扣积分
6. 生图失败不扣积分
7. 查询充值与消费记录

第一期聚焦最小可行方案，不做订阅制和复杂后台。

## MVP 范围

第一期必须完成：

1. 用户认证
2. 积分账户体系
3. Stripe Checkout 支付积分包
4. Stripe Webhook 发放积分
5. AI 生图扣积分
6. 余额和账单记录展示

第一期不做：

1. 订阅制
2. 多币种
3. 自动退款流程
4. 发票与税务系统
5. 邀请返利
6. 复杂运营后台

## 推荐技术选型

基于当前项目架构，推荐：

1. 认证：Clerk 或 Supabase Auth
2. 支付：Stripe Checkout + Webhook
3. 数据库：Cloudflare D1
4. 服务层：Cloudflare Worker
5. 风控：Cloudflare Turnstile + 限流

推荐优先组合：

1. Clerk
2. Stripe
3. D1

原因：接入成本低，文档成熟，适合当前静态前端 + Worker 的项目结构。

## 积分计费模型

第一期建议使用固定积分消耗，不做动态成本核算。

推荐规则：

1. Gemini：1 积分/次
2. OpenAI：3 积分/次

推荐积分包：

1. Starter：100 积分，$4.99
2. Pro：350 积分，$14.99
3. Plus：1000 积分，$29.99

## 数据库设计

建议最少建立 5 张表：

1. users
2. credit_accounts
3. orders
4. credit_transactions
5. generation_requests

### 建表示例 SQL

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE credit_accounts (
  user_id TEXT PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  stripe_session_id TEXT NOT NULL UNIQUE,
  stripe_payment_intent_id TEXT,
  package_id TEXT NOT NULL,
  amount_paid_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  credits_granted INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE credit_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER,
  related_order_id TEXT,
  related_request_id TEXT,
  provider TEXT,
  status TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE generation_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  prompt_length INTEGER NOT NULL,
  cost_credits INTEGER NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX idx_generation_requests_id ON generation_requests(id);
CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_orders_user_id ON orders(user_id);
```

### 字段约定

`credit_transactions.type` 建议取值：

1. topup
2. generate_debit
3. refund
4. admin_adjust

`credit_transactions.status` 建议取值：

1. pending
2. succeeded
3. failed

`generation_requests.status` 建议取值：

1. pending
2. succeeded
3. failed

## Worker 配置

需要新增以下绑定和密钥：

1. D1 绑定：DB
2. STRIPE_SECRET_KEY
3. STRIPE_WEBHOOK_SECRET
4. CLERK_SECRET_KEY 或对应认证服务密钥
5. TURNSTILE_SECRET_KEY

`wrangler.toml` 需要增加 D1 配置：

```toml
[[d1_databases]]
binding = "DB"
database_name = "poem-to-image"
database_id = "your-d1-id"
```

## API 设计

建议新增以下接口：

1. `GET /api/me`
2. `GET /api/billing/balance`
3. `GET /api/billing/packages`
4. `POST /api/billing/checkout-session`
5. `POST /api/billing/webhook/stripe`
6. `GET /api/billing/history`
7. `POST /api/ai-background`

### 接口职责

`GET /api/me`

1. 返回当前登录用户信息

`GET /api/billing/balance`

1. 返回当前积分余额

`GET /api/billing/packages`

1. 返回可购买积分包列表

`POST /api/billing/checkout-session`

1. 创建 Stripe Checkout Session

`POST /api/billing/webhook/stripe`

1. 接收 Stripe Webhook
2. 完成支付验签
3. 发放积分

`GET /api/billing/history`

1. 返回充值和消费记录

`POST /api/ai-background`

1. 校验用户身份
2. 校验余额
3. 记录请求
4. 调用模型
5. 成功扣费
6. 失败不扣费

## 接口示例

### `GET /api/billing/balance`

```json
{
  "userId": "user_123",
  "balance": 128
}
```

### `GET /api/billing/packages`

```json
{
  "packages": [
    {
      "id": "starter_100",
      "name": "Starter",
      "credits": 100,
      "priceCents": 499,
      "currency": "usd"
    },
    {
      "id": "pro_350",
      "name": "Pro",
      "credits": 350,
      "priceCents": 1499,
      "currency": "usd"
    }
  ]
}
```

### `POST /api/billing/checkout-session`

请求：

```json
{
  "packageId": "starter_100"
}
```

响应：

```json
{
  "checkoutUrl": "https://checkout.stripe.com/..."
}
```

### `GET /api/billing/history`

```json
{
  "items": [
    {
      "id": "txn_1",
      "type": "topup",
      "amount": 100,
      "status": "succeeded",
      "createdAt": "2026-03-15T12:00:00Z"
    },
    {
      "id": "txn_2",
      "type": "generate_debit",
      "amount": -3,
      "provider": "openai",
      "status": "succeeded",
      "createdAt": "2026-03-15T12:10:00Z"
    }
  ]
}
```

### `POST /api/ai-background`

请求：

```json
{
  "provider": "openai",
  "prompt": "...",
  "aspectRatio": "1:1",
  "requestId": "uuid-from-client"
}
```

响应成功：

```json
{
  "imageDataUrl": "data:image/png;base64,...",
  "creditsCharged": 3,
  "balance": 125
}
```

响应失败：

```json
{
  "error": "Insufficient credits.",
  "code": "INSUFFICIENT_CREDITS",
  "balance": 0
}
```

## 用户认证流程

推荐流程：

1. 前端登录
2. 前端请求 Worker 时带上认证 token
3. Worker 校验 token
4. Worker 解析 userId 和 email
5. 若数据库不存在该用户，则自动创建 `users` 和 `credit_accounts`

Worker 侧建议统一封装：

1. `getAuthenticatedUser(request, env)`

返回：

1. `userId`
2. `email`

## Stripe 支付流程

完整链路：

1. 用户点击购买积分包
2. 前端调用 `POST /api/billing/checkout-session`
3. Worker 校验用户身份
4. Worker 根据 `packageId` 创建 Stripe Checkout Session
5. Worker 在 Stripe metadata 中写入 `userId` 和 `packageId`
6. 前端跳转 Stripe Checkout
7. 用户完成支付
8. Stripe 调用 `POST /api/billing/webhook/stripe`
9. Worker 验签 Webhook
10. Worker 写入 `orders`
11. Worker 增加 `credit_accounts.balance`
12. Worker 写入一条 `credit_transactions(type=topup)`

### 支付注意事项

1. 只能信任 Stripe Webhook
2. 必须校验 Webhook 签名
3. `stripe_session_id` 需要唯一约束
4. Webhook 处理必须幂等

## AI 生图扣费流程

建议流程：

1. 前端生成 `requestId`
2. 前端调用 `POST /api/ai-background`
3. Worker 校验用户身份
4. Worker 根据 provider 计算积分成本
5. Worker 查询余额
6. 余额不足则直接拒绝
7. Worker 写入 `generation_requests(status=pending)`
8. Worker 写入 `credit_transactions(status=pending, type=generate_debit)`
9. Worker 调用 Gemini 或 OpenAI
10. 调用成功后扣减余额
11. 更新 `generation_requests` 为 `succeeded`
12. 更新 `credit_transactions` 为 `succeeded`
13. 返回图片与新余额
14. 如果调用失败，更新请求与交易状态为 `failed`
15. 不扣余额

## 幂等和事务要求

必须满足：

1. 同一个 `requestId` 不重复扣费
2. 同一个 Stripe Session 不重复发积分
3. 失败请求不扣积分

建议策略：

1. `requestId` 全局唯一
2. `stripe_session_id` 全局唯一
3. 扣费与交易状态更新要保持固定顺序
4. 前端重试时复用同一个 `requestId`

## Worker 模块拆分建议

建议把当前 Worker 拆成以下模块：

1. `worker/index.ts`
2. `worker/auth.ts`
3. `worker/db.ts`
4. `worker/billing.ts`
5. `worker/stripe.ts`
6. `worker/ai.ts`

建议实现的函数：

1. `getAuthenticatedUser`
2. `getCreditCostByProvider`
3. `getBalance`
4. `createCheckoutSession`
5. `handleStripeWebhook`
6. `reserveGenerationRequest`
7. `finalizeGenerationSuccess`
8. `finalizeGenerationFailure`
9. `generateWithGemini`
10. `generateWithOpenAi`

## 前端改造清单

第一期前端建议新增这些能力：

1. 登录入口
2. 当前余额展示
3. 购买积分入口
4. 消费记录入口
5. 生图区域显示本次积分消耗
6. 生图成功后刷新余额
7. 生图失败时显示未扣费提示

建议新增 Hook：

1. `src/hooks/useAuth.ts`
2. `src/hooks/useBalance.ts`
3. `src/hooks/useBillingPackages.ts`
4. `src/hooks/useBillingHistory.ts`

建议新增组件：

1. `src/components/sidebar/BillingPanel.tsx`

## 风控要求

第一期至少做到：

1. 未登录用户不能调用生图接口
2. 每个用户每分钟最多 5 次生成
3. 每个 IP 每分钟最多 10 次生成
4. 购买接口接入 Turnstile
5. Stripe Webhook 必须验签
6. OpenAI 请求需要更严格的限流

推荐限流键：

1. `generate:user:{userId}`
2. `generate:ip:{ip}`

## 失败场景与处理策略

1. 支付成功但 Webhook 超时：依赖 Stripe 重试，接口必须幂等
2. 用户重复点击购买：允许创建多个 Session，但只处理成功支付的 Session
3. 生图超时或 provider 返回错误：不扣积分
4. 前端因网络重试重复请求：依赖 `requestId` 幂等处理
5. 响应丢失但实际已扣费：用户可通过余额和账单恢复状态

## 里程碑拆分

### 里程碑 1：认证接入

目标：Worker 能识别登录用户

任务：

1. 接入 Clerk 或 Supabase Auth
2. 实现 Worker 认证解析
3. 实现 `GET /api/me`

验收：

1. 未登录访问受保护接口时返回 401
2. 已登录用户可返回 userId 和 email

### 里程碑 2：积分账户

目标：用户首次访问自动开户，余额接口可用

任务：

1. 创建 D1 数据库和迁移脚本
2. 建立 `users` 和 `credit_accounts`
3. 实现 `GET /api/billing/balance`

验收：

1. 新用户首次访问自动建档
2. 余额接口可返回正确值

### 里程碑 3：Stripe 支付

目标：用户能购买积分，支付成功后自动到账

任务：

1. 实现 `GET /api/billing/packages`
2. 实现 `POST /api/billing/checkout-session`
3. 实现 `POST /api/billing/webhook/stripe`

验收：

1. 用户能跳转到 Stripe Checkout
2. 支付成功后余额增加一次且仅增加一次

### 里程碑 4：AI 生图扣费

目标：生图前检查余额，成功后扣积分

任务：

1. 改造 `POST /api/ai-background`
2. 增加请求记录和交易记录
3. 成功扣费，失败不扣费

验收：

1. 余额不足时无法生图
2. 生图成功后积分减少
3. 生图失败后积分不变

### 里程碑 5：账单与风控

目标：用户可查看记录，接口具备基础防刷能力

任务：

1. 实现 `GET /api/billing/history`
2. 增加前端余额和账单入口
3. 增加限流与 Turnstile

验收：

1. 用户可查看最近消费记录
2. 高频调用会被限流

## 可直接执行的开发任务单

1. 新建 D1 数据库及迁移脚本
2. 在 `wrangler.toml` 增加 D1 绑定
3. 增加 Stripe 和认证密钥配置
4. 实现 Worker 统一认证方法
5. 实现 `GET /api/me`
6. 实现 `GET /api/billing/balance`
7. 实现 `GET /api/billing/packages`
8. 实现 `POST /api/billing/checkout-session`
9. 实现 `POST /api/billing/webhook/stripe`
10. 改造 `POST /api/ai-background` 支持扣积分
11. 新增前端余额展示
12. 新增购买积分入口
13. 新增消费记录入口
14. 新增限流和 Turnstile
15. 增加日志字段：`userId`、`provider`、`requestId`、`creditsCharged`、`status`

## 验收清单

1. 未登录用户调用 AI 生图接口会被拒绝
2. 新用户首次访问自动创建账户
3. Stripe 支付成功后积分只增加一次
4. 余额不足时无法生成图片
5. 生成成功后余额减少正确
6. 生成失败后余额不变
7. 同一 `requestId` 重试不会重复扣费
8. 用户可在前端看到余额和最近账单记录
