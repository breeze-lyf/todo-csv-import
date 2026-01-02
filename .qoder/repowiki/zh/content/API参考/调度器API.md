# 调度器API

<cite>
**本文引用的文件**
- [app/api/scheduler/run/route.ts](file://app/api/scheduler/run/route.ts)
- [lib/scheduler.ts](file://lib/scheduler.ts)
- [lib/web-push.ts](file://lib/web-push.ts)
- [lib/prisma.ts](file://lib/prisma.ts)
- [lib/reminder-jobs.ts](file://lib/reminder-jobs.ts)
- [middleware.ts](file://middleware.ts)
- [vercel.json](file://vercel.json)
- [docs/SCHEDULER_SETUP.md](file://docs/SCHEDULER_SETUP.md)
- [docs/WEB_PUSH_DEBUG.md](file://docs/WEB_PUSH_DEBUG.md)
- [app/api/push/vapid-public-key/route.ts](file://app/api/push/vapid-public-key/route.ts)
- [app/api/push/subscribe/route.ts](file://app/api/push/subscribe/route.ts)
</cite>

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构总览](#架构总览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能考量](#性能考量)
8. [故障排查指南](#故障排查指南)
9. [结论](#结论)
10. [附录](#附录)

## 简介
本文件面向外部调度器（如 Vercel Cron 或其他定时任务服务）提供“调度器触发接口”（/api/scheduler/run）的安全调用指南。该端点用于手动触发提醒任务的检查与发送流程，内部调用 lib/scheduler.ts 的执行函数，完成待处理提醒的查询、Web Push 消息发送（通过 web-push 库）以及状态更新。文档强调该端点的安全性设计建议（如密钥验证），并提供 curl 调用示例、成功响应与常见错误的含义说明。

## 项目结构
该接口位于 Next.js App Router 的 API 路由中，配合调度器执行逻辑与数据库访问层协同工作。

```mermaid
graph TB
subgraph "API 层"
R["/api/scheduler/run/route.ts<br/>POST/GET 入口"]
end
subgraph "调度器执行层"
S["lib/scheduler.ts<br/>runReminderScheduler()"]
RJ["lib/reminder-jobs.ts<br/>getPendingReminderJobs/markJobAsSent"]
end
subgraph "推送层"
WP["lib/web-push.ts<br/>sendPushNotification()"]
VP["/api/push/vapid-public-key/route.ts<br/>VAPID 公钥"]
end
subgraph "数据访问层"
PZ["lib/prisma.ts<br/>Prisma 客户端"]
end
R --> S
S --> RJ
S --> WP
S --> PZ
VP --> WP
```

图表来源
- [app/api/scheduler/run/route.ts](file://app/api/scheduler/run/route.ts#L1-L37)
- [lib/scheduler.ts](file://lib/scheduler.ts#L1-L86)
- [lib/reminder-jobs.ts](file://lib/reminder-jobs.ts#L1-L109)
- [lib/web-push.ts](file://lib/web-push.ts#L1-L54)
- [lib/prisma.ts](file://lib/prisma.ts#L1-L20)
- [app/api/push/vapid-public-key/route.ts](file://app/api/push/vapid-public-key/route.ts#L1-L12)

章节来源
- [app/api/scheduler/run/route.ts](file://app/api/scheduler/run/route.ts#L1-L37)
- [lib/scheduler.ts](file://lib/scheduler.ts#L1-L86)
- [lib/reminder-jobs.ts](file://lib/reminder-jobs.ts#L1-L109)
- [lib/web-push.ts](file://lib/web-push.ts#L1-L54)
- [lib/prisma.ts](file://lib/prisma.ts#L1-L20)
- [app/api/push/vapid-public-key/route.ts](file://app/api/push/vapid-public-key/route.ts#L1-L12)

## 核心组件
- 调度器触发 API：接收外部定时任务的 POST 请求，调用调度器执行函数，返回处理统计与状态。
- 调度器执行函数：查询待处理提醒、按用户订阅发送 Web Push、清理无效订阅、标记任务为已发送。
- Web Push 发送：基于 web-push 库与 VAPID 凭据，向用户订阅端点发送通知。
- 数据访问层：通过 Prisma 客户端访问 PostgreSQL 数据库。
- 中间件与安全：当前路由未内置认证，建议在生产环境中增加密钥校验；现有中间件主要保护受保护路径。

章节来源
- [app/api/scheduler/run/route.ts](file://app/api/scheduler/run/route.ts#L8-L26)
- [lib/scheduler.ts](file://lib/scheduler.ts#L8-L85)
- [lib/web-push.ts](file://lib/web-push.ts#L28-L46)
- [lib/prisma.ts](file://lib/prisma.ts#L9-L19)
- [middleware.ts](file://middleware.ts#L5-L44)

## 架构总览
外部定时任务（如 Vercel Cron）通过 HTTP POST 触发 /api/scheduler/run，API 层调用调度器执行函数，后者从数据库查询待处理提醒，遍历用户订阅并发送 Web Push，最后更新任务状态。

```mermaid
sequenceDiagram
participant Cron as "外部定时任务"
participant API as "调度器触发API"
participant Sched as "调度器执行函数"
participant Jobs as "提醒任务查询"
participant DB as "数据库"
participant Push as "Web Push 发送"
participant VAPID as "VAPID 公钥接口"
Cron->>API : "POST /api/scheduler/run"
API->>Sched : "runReminderScheduler()"
Sched->>Jobs : "getPendingReminderJobs()"
Jobs->>DB : "查询待处理提醒"
DB-->>Jobs : "返回提醒列表"
loop 遍历每个提醒
Sched->>DB : "查询用户订阅"
DB-->>Sched : "返回订阅列表"
Sched->>Push : "sendPushNotification(subscription, payload)"
Push->>VAPID : "读取VAPID公钥"
Push-->>Sched : "发送结果"
alt 发送成功
Sched->>DB : "markJobAsSent(jobId)"
else 发送失败且410(Gone)
Sched->>DB : "删除无效订阅"
end
end
Sched-->>API : "{ processed : N }"
API-->>Cron : "200 OK { success, processed }"
```

图表来源
- [app/api/scheduler/run/route.ts](file://app/api/scheduler/run/route.ts#L8-L18)
- [lib/scheduler.ts](file://lib/scheduler.ts#L13-L77)
- [lib/reminder-jobs.ts](file://lib/reminder-jobs.ts#L77-L98)
- [lib/web-push.ts](file://lib/web-push.ts#L28-L46)
- [app/api/push/vapid-public-key/route.ts](file://app/api/push/vapid-public-key/route.ts#L4-L11)

## 详细组件分析

### 调度器触发 API（/api/scheduler/run）
- 功能：接收外部定时任务的 POST 请求，调用调度器执行函数，返回处理统计与状态；提供 GET 接口用于健康检查。
- 当前安全设计：注释提示可添加认证/授权（例如 Bearer Token），当前实现允许任何人触发。
- 成功响应：包含 success 字段与 processed 统计（表示本次处理的提醒数量）。
- 错误响应：捕获异常后返回统一的错误结构与 500 状态码。

章节来源
- [app/api/scheduler/run/route.ts](file://app/api/scheduler/run/route.ts#L8-L26)
- [docs/SCHEDULER_SETUP.md](file://docs/SCHEDULER_SETUP.md#L68-L87)

### 调度器执行函数（runReminderScheduler）
- 查询待处理提醒：通过提醒任务查询函数获取 fireTime 小等于当前时间且未发送的任务。
- 用户订阅处理：针对每个提醒，查询用户的所有订阅；若无订阅则直接标记为已发送。
- Web Push 发送：构造通知负载，逐个订阅发送；记录发送结果。
- 失败处理：若收到 410（Gone）错误，删除无效订阅。
- 状态更新：发送完成后将任务标记为已发送。

```mermaid
flowchart TD
Start(["进入调度器"]) --> Fetch["查询待处理提醒"]
Fetch --> HasJobs{"有待处理提醒？"}
HasJobs --> |否| Done["返回 processed=0"]
HasJobs --> |是| LoopJobs["遍历每个提醒"]
LoopJobs --> SubFetch["查询用户订阅"]
SubFetch --> HasSubs{"存在订阅？"}
HasSubs --> |否| MarkSent["标记为已发送"] --> NextJob["下一个提醒"]
HasSubs --> |是| BuildPayload["构建通知负载"]
BuildPayload --> SendLoop["遍历订阅发送"]
SendLoop --> SendRes{"发送成功？"}
SendRes --> |是| NextSub["继续下一个订阅"]
SendRes --> |否| Check410{"错误码为410？"}
Check410 --> |是| DelSub["删除无效订阅"] --> NextSub
Check410 --> |否| LogErr["记录错误"] --> NextSub
NextSub --> MoreSubs{"还有订阅？"}
MoreSubs --> |是| SendLoop
MoreSubs --> |否| MarkSent --> NextJob
NextJob --> MoreJobs{"还有提醒？"}
MoreJobs --> |是| LoopJobs
MoreJobs --> |否| Return["返回 processed=N"]
```

图表来源
- [lib/scheduler.ts](file://lib/scheduler.ts#L13-L77)
- [lib/reminder-jobs.ts](file://lib/reminder-jobs.ts#L77-L98)
- [lib/web-push.ts](file://lib/web-push.ts#L28-L46)

章节来源
- [lib/scheduler.ts](file://lib/scheduler.ts#L8-L85)

### Web Push 发送与 VAPID 配置
- VAPID 凭据：从环境变量读取公钥、私钥与主题，初始化 web-push 设置。
- 发送流程：将订阅信息与通知负载序列化后发送；返回成功/失败结果。
- VAPID 公钥接口：对外暴露公钥供客户端订阅时使用。

章节来源
- [lib/web-push.ts](file://lib/web-push.ts#L3-L15)
- [lib/web-push.ts](file://lib/web-push.ts#L28-L46)
- [app/api/push/vapid-public-key/route.ts](file://app/api/push/vapid-public-key/route.ts#L4-L11)

### 数据访问层（Prisma）
- 连接池：基于 DATABASE_URL 创建连接池并注入 Prisma 客户端。
- 作用：为提醒任务、用户订阅等模型提供查询与更新能力。

章节来源
- [lib/prisma.ts](file://lib/prisma.ts#L9-L19)

### 提醒任务查询与状态更新
- 查询待处理提醒：筛选 sent=false 且 fireTime ≤ 当前时间的任务，同时包含事件与用户信息。
- 标记已发送：将对应任务的 sent 字段更新为 true。

章节来源
- [lib/reminder-jobs.ts](file://lib/reminder-jobs.ts#L77-L98)
- [lib/reminder-jobs.ts](file://lib/reminder-jobs.ts#L103-L108)

### 中间件与安全现状
- 当前中间件主要用于受保护路径的登录态校验，不直接拦截 /api/scheduler/run。
- 建议在生产环境中为该端点增加密钥校验（如 Authorization: Bearer Token）。

章节来源
- [middleware.ts](file://middleware.ts#L5-L44)
- [docs/SCHEDULER_SETUP.md](file://docs/SCHEDULER_SETUP.md#L68-L87)

## 依赖关系分析
- API 层依赖调度器执行函数。
- 调度器执行函数依赖提醒任务查询与状态更新、Web Push 发送、数据库访问。
- Web Push 发送依赖 VAPID 配置与公钥接口。
- 数据库访问依赖 Prisma 客户端与连接池。

```mermaid
graph LR
API["/api/scheduler/run/route.ts"] --> SCHED["lib/scheduler.ts"]
SCHED --> REM["lib/reminder-jobs.ts"]
SCHED --> PUSH["lib/web-push.ts"]
SCHED --> DB["lib/prisma.ts"]
PUSH --> VAPID["/api/push/vapid-public-key/route.ts"]
```

图表来源
- [app/api/scheduler/run/route.ts](file://app/api/scheduler/run/route.ts#L1-L2)
- [lib/scheduler.ts](file://lib/scheduler.ts#L1-L3)
- [lib/reminder-jobs.ts](file://lib/reminder-jobs.ts#L1-L3)
- [lib/web-push.ts](file://lib/web-push.ts#L1-L1)
- [lib/prisma.ts](file://lib/prisma.ts#L1-L3)
- [app/api/push/vapid-public-key/route.ts](file://app/api/push/vapid-public-key/route.ts#L1-L2)

章节来源
- [app/api/scheduler/run/route.ts](file://app/api/scheduler/run/route.ts#L1-L2)
- [lib/scheduler.ts](file://lib/scheduler.ts#L1-L3)
- [lib/reminder-jobs.ts](file://lib/reminder-jobs.ts#L1-L3)
- [lib/web-push.ts](file://lib/web-push.ts#L1-L1)
- [lib/prisma.ts](file://lib/prisma.ts#L1-L3)
- [app/api/push/vapid-public-key/route.ts](file://app/api/push/vapid-public-key/route.ts#L1-L2)

## 性能考量
- 并发与批量：当前实现逐条发送通知，若订阅数较多，建议评估批量发送与并发控制策略。
- 数据库压力：查询与更新操作在循环内执行，建议关注索引与事务边界，避免长事务阻塞。
- 错误恢复：对 410 订阅的自动清理有助于减少后续失败重试成本。
- VAPID 初始化：仅在公钥/私钥存在时设置，避免不必要的初始化开销。

## 故障排查指南
- 数据库连接失败：检查 DATABASE_URL 环境变量与连接池配置。
- VAPID 未配置：VAPID 公钥为空时，相关接口会返回 500；请生成并配置 VAPID 凭据。
- Web Push 发送失败：查看日志中的错误详情；若出现 410，则会自动清理无效订阅。
- 认证失败：当前 API 未强制认证，建议在生产中加入 Bearer Token 校验。
- 健康检查：GET /api/scheduler/run 返回 ready 状态，提示使用 POST 触发。

章节来源
- [lib/prisma.ts](file://lib/prisma.ts#L9-L19)
- [lib/web-push.ts](file://lib/web-push.ts#L5-L15)
- [app/api/scheduler/run/route.ts](file://app/api/scheduler/run/route.ts#L31-L36)
- [docs/WEB_PUSH_DEBUG.md](file://docs/WEB_PUSH_DEBUG.md#L1-L166)

## 结论
调度器触发接口为外部定时任务提供了稳定、可扩展的提醒分发入口。当前实现简洁清晰，但在生产环境中应加强安全控制（如密钥验证）。通过合理的 VAPID 配置与数据库优化，可确保高可用的通知投递体验。

## 附录

### 安全调用指南
- 建议在生产环境中为 /api/scheduler/run 添加 Bearer Token 校验（Authorization 头），令牌来自环境变量。
- 在 Vercel 上部署时，可结合 vercel.json 的 Cron 配置进行定时触发。
- 本地或自建 Cron 可使用 curl 按如下方式触发。

章节来源
- [docs/SCHEDULER_SETUP.md](file://docs/SCHEDULER_SETUP.md#L68-L87)
- [vercel.json](file://vercel.json#L1-L8)

### curl 调用示例
- 健康检查（GET）
  - curl -X GET https://your-domain.vercel.app/api/scheduler/run
- 触发调度（POST，建议加上 Authorization 头）
  - curl -X POST https://your-domain.vercel.app/api/scheduler/run -H "Authorization: Bearer YOUR_SCHEDULER_SECRET"

说明
- 若未配置认证，当前实现允许匿名触发；建议尽快添加密钥校验。
- Authorization 头格式为 Bearer TOKEN，TOKEN 来自环境变量。

章节来源
- [app/api/scheduler/run/route.ts](file://app/api/scheduler/run/route.ts#L8-L11)
- [docs/SCHEDULER_SETUP.md](file://docs/SCHEDULER_SETUP.md#L70-L87)

### 响应与错误说明
- 成功响应
  - 字段：success（布尔）、processed（数字，表示本次处理的提醒数量）
  - 示例：{ "success": true, "processed": 5 }
- 错误响应
  - 字段：success（布尔）、error（字符串）
  - 示例：{ "success": false, "error": "Scheduler failed" }
- 常见错误
  - 数据库连接失败：检查 DATABASE_URL 与网络连通性
  - VAPID 未配置：检查 VAPID 公钥/私钥环境变量
  - Web Push 发送失败：查看日志中的具体错误；410 表示订阅失效，系统会自动清理

章节来源
- [app/api/scheduler/run/route.ts](file://app/api/scheduler/run/route.ts#L15-L25)
- [lib/web-push.ts](file://lib/web-push.ts#L42-L45)
- [lib/scheduler.ts](file://lib/scheduler.ts#L61-L68)