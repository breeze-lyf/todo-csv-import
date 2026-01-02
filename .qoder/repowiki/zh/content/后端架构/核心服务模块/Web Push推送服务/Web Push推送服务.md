# Web Push推送服务

<cite>
**本文档中引用的文件**   
- [web-push.ts](file://lib/web-push.ts)
- [vapid-public-key/route.ts](file://app/api/push/vapid-public-key/route.ts)
- [subscribe/route.ts](file://app/api/push/subscribe/route.ts)
- [sw.js](file://public/sw.js)
- [scheduler.ts](file://lib/scheduler.ts)
- [reminder-jobs.ts](file://lib/reminder-jobs.ts)
- [schema.prisma](file://prisma/schema.prisma)
- [ServiceWorkerRegistration.tsx](file://components/ServiceWorkerRegistration.tsx)
- [NotificationPermissionPrompt.tsx](file://components/NotificationPermissionPrompt.tsx)
- [settings/page.tsx](file://app/settings/page.tsx)
- [WEB_PUSH_DEBUG.md](file://docs/WEB_PUSH_DEBUG.md)
- [SCHEDULER_SETUP.md](file://docs/SCHEDULER_SETUP.md)
</cite>

## 目录
1. [项目结构](#项目结构)
2. [核心组件](#核心组件)
3. [VAPID密钥机制](#vapid密钥机制)
4. [前端与后端协同流程](#前端与后端协同流程)
5. [加密消息推送过程](#加密消息推送过程)
6. [错误处理与订阅清理](#错误处理与订阅清理)
7. [调度器集成](#调度器集成)
8. [安全考虑](#安全考虑)
9. [架构概览](#架构概览)
10. [依赖分析](#依赖分析)

## 项目结构

本项目采用Next.js架构，Web Push相关功能分布在多个目录中。核心推送逻辑位于`lib/web-push.ts`，API路由定义在`app/api/push/`目录下，前端服务工作线程位于`public/sw.js`。数据库模型通过Prisma定义在`prisma/schema.prisma`中。

```mermaid
graph TB
subgraph "前端"
SW["public/sw.js<br/>服务工作线程"]
Client["客户端<br/>PushManager"]
end
subgraph "API接口"
VAPID["/api/push/vapid-public-key<br/>获取公钥"]
Subscribe["/api/push/subscribe<br/>订阅管理"]
Scheduler["/api/scheduler/run<br/>调度触发"]
end
subgraph "后端逻辑"
WebPush["lib/web-push.ts<br/>推送封装"]
SchedulerLib["lib/scheduler.ts<br/>调度逻辑"]
ReminderJobs["lib/reminder-jobs.ts<br/>提醒任务"]
end
subgraph "数据存储"
DB["prisma/schema.prisma<br/>PushSubscription模型"]
end
Client --> VAPID
Client --> Subscribe
Scheduler --> SchedulerLib
SchedulerLib --> WebPush
SchedulerLib --> DB
WebPush --> DB
Subscribe --> DB
style SW fill:#f9f,stroke:#333
style Client fill:#bbf,stroke:#333
style VAPID fill:#f96,stroke:#333
style Subscribe fill:#f96,stroke:#333
style Scheduler fill:#f96,stroke:#333
style WebPush fill:#6f9,stroke:#333
style SchedulerLib fill:#6f9,stroke:#333
style ReminderJobs fill:#6f9,stroke:#333
style DB fill:#69f,stroke:#333
```

**Diagram sources**
- [web-push.ts](file://lib/web-push.ts)
- [vapid-public-key/route.ts](file://app/api/push/vapid-public-key/route.ts)
- [subscribe/route.ts](file://app/api/push/subscribe/route.ts)
- [sw.js](file://public/sw.js)
- [scheduler.ts](file://lib/scheduler.ts)
- [schema.prisma](file://prisma/schema.prisma)

**Section sources**
- [lib/web-push.ts](file://lib/web-push.ts)
- [app/api/push/vapid-public-key/route.ts](file://app/api/push/vapid-public-key/route.ts)
- [app/api/push/subscribe/route.ts](file://app/api/push/subscribe/route.ts)
- [public/sw.js](file://public/sw.js)
- [lib/scheduler.ts](file://lib/scheduler.ts)
- [prisma/schema.prisma](file://prisma/schema.prisma)

## 核心组件

系统核心组件包括Web Push封装库、API路由处理器、服务工作线程和调度器。`web-push.ts`封装了web-push库的核心功能，提供类型安全的推送接口。`subscribe/route.ts`处理订阅的创建与删除，包含完整的身份验证和输入验证。`sw.js`作为服务工作线程，负责接收推送消息并显示通知。

**Section sources**
- [web-push.ts](file://lib/web-push.ts)
- [subscribe/route.ts](file://app/api/push/subscribe/route.ts)
- [sw.js](file://public/sw.js)

## VAPID密钥机制

VAPID（Voluntary Application Server Identification）密钥用于标识推送服务来源。公私钥对通过`npx web-push generate-vapid-keys`命令生成，并存储在环境变量中。公钥通过`NEXT_PUBLIC_VAPID_PUBLIC_KEY`暴露给前端，私钥`VAPID_PRIVATE_KEY`仅在后端使用。`VAPID_SUBJECT`通常设置为联系邮箱。

```mermaid
sequenceDiagram
participant Frontend as 前端
participant API as /api/push/vapid-public-key
participant Lib as web-push.ts
Frontend->>API : GET请求
API->>Lib : 调用getVapidPublicKey()
Lib-->>API : 返回公钥
API-->>Frontend : JSON响应{publicKey}
Note over API,Lib : 密钥从环境变量加载<br/>未配置时返回500错误
```

**Diagram sources**
- [web-push.ts](file://lib/web-push.ts#L5-L53)
- [vapid-public-key/route.ts](file://app/api/push/vapid-public-key/route.ts#L1-L12)

**Section sources**
- [web-push.ts](file://lib/web-push.ts#L1-L53)
- [vapid-public-key/route.ts](file://app/api/push/vapid-public-key/route.ts#L1-L12)

## 前端与后端协同流程

前端通过`PushManager.subscribe`注册推送订阅，后端通过API保存`PushSubscription`对象。流程始于服务工作线程注册，随后获取VAPID公钥，最后发送订阅信息到后端。

```mermaid
sequenceDiagram
participant Page as settings/page.tsx
participant SW as ServiceWorker
participant VAPID as /api/push/vapid-public-key
participant Subscribe as /api/push/subscribe
participant DB as 数据库
Page->>SW : navigator.serviceWorker.ready
Page->>VAPID : 获取公钥
VAPID-->>Page : 返回公钥
Page->>SW : subscribe(applicationServerKey)
SW-->>Page : 返回PushSubscription
Page->>Subscribe : POST订阅数据
Subscribe->>DB : 保存订阅
DB-->>Subscribe : 返回结果
Subscribe-->>Page : 响应结果
```

**Diagram sources**
- [settings/page.tsx](file://app/settings/page.tsx#L125-L143)
- [subscribe/route.ts](file://app/api/push/subscribe/route.ts#L14-L57)
- [schema.prisma](file://prisma/schema.prisma#L76-L85)

**Section sources**
- [settings/page.tsx](file://app/settings/page.tsx#L125-L143)
- [subscribe/route.ts](file://app/api/push/subscribe/route.ts#L14-L57)
- [schema.prisma](file://prisma/schema.prisma#L76-L85)

## 加密消息推送过程

推送消息通过web-push库进行加密，使用ECDH密钥交换和AES-GCM加密算法。后端构建消息负载，调用`sendPushNotification`方法，库自动处理加密和HTTPS请求发送到推送服务（如FCM）。

```mermaid
flowchart TD
Start([开始发送通知]) --> Prepare["准备通知负载<br>{title, body, data}"]
Prepare --> GetSubs["获取用户订阅列表"]
GetSubs --> HasSubs{"存在订阅?"}
HasSubs --> |否| MarkSent["标记任务为已发送"]
HasSubs --> |是| Encrypt["使用web-push加密"]
Encrypt --> Send["发送HTTPS请求到推送服务"]
Send --> Success{"成功?"}
Success --> |是| Count["增加成功计数"]
Success --> |否| CheckError["检查错误类型"]
CheckError --> Is410{"状态码410?"}
Is410 --> |是| DeleteSub["删除无效订阅"]
Is410 --> |否| LogError["记录错误"]
Count --> NextSub
DeleteSub --> NextSub
LogError --> NextSub
NextSub --> MoreSubs{"还有订阅?"}
MoreSubs --> |是| Encrypt
MoreSubs --> |否| MarkSent
MarkSent --> End([结束])
style Start fill:#f9f,stroke:#333
style End fill:#f9f,stroke:#333
```

**Diagram sources**
- [web-push.ts](file://lib/web-push.ts#L28-L46)
- [scheduler.ts](file://lib/scheduler.ts#L42-L69)

**Section sources**
- [web-push.ts](file://lib/web-push.ts#L28-L46)
- [scheduler.ts](file://lib/scheduler.ts#L42-L69)

## 错误处理与订阅清理

系统处理推送错误，特别是410 Gone状态码，表示订阅已失效。当收到410响应时，系统自动从数据库中删除对应的`PushSubscription`记录，避免后续无效推送尝试。

```mermaid
stateDiagram-v2
[*] --> 发送通知
发送通知 --> 成功 : statusCode 201
发送通知 --> 失败 : 其他状态码
失败 --> 检查错误
检查错误 --> 410失效 : statusCode === 410
检查错误 --> 其他错误 : 其他情况
410失效 --> 删除订阅
删除订阅 --> 记录日志
其他错误 --> 记录日志
记录日志 --> 结束
成功 --> 结束
结束 --> [*]
note right of 410失效
自动清理无效订阅
防止重复失败
end note
```

**Diagram sources**
- [scheduler.ts](file://lib/scheduler.ts#L61-L67)
- [subscribe/route.ts](file://app/api/push/subscribe/route.ts#L64-L65)

**Section sources**
- [scheduler.ts](file://lib/scheduler.ts#L61-L67)
- [subscribe/route.ts](file://app/api/push/subscribe/route.ts#L64-L65)

## 调度器集成

提醒调度器定期检查待处理的提醒任务，当触发时间到达时，调用推送服务发送通知。调度器通过`/api/scheduler/run`端点触发，可配置为每分钟运行一次。

```mermaid
sequenceDiagram
participant Cron as 定时任务
participant API as /api/scheduler/run
participant Scheduler as runReminderScheduler
participant Jobs as getPendingReminderJobs
participant Push as sendPushNotification
Cron->>API : POST请求
API->>Scheduler : 执行调度
Scheduler->>Jobs : 查询待处理任务
Jobs-->>Scheduler : 返回任务列表
loop 每个待处理任务
Scheduler->>Scheduler : 获取用户订阅
loop 每个订阅
Scheduler->>Push : 发送推送通知
Push-->>Scheduler : 返回结果
alt 订阅失效(410)
Scheduler->>DB : 删除订阅记录
end
end
Scheduler->>DB : 标记任务为已发送
end
Scheduler-->>API : 返回处理结果
API-->>Cron : 响应结果
```

**Diagram sources**
- [scheduler.ts](file://lib/scheduler.ts#L8-L85)
- [reminder-jobs.ts](file://lib/reminder-jobs.ts#L77-L97)
- [api/scheduler/run/route.ts](file://app/api/scheduler/run/route.ts#L8-L17)

**Section sources**
- [scheduler.ts](file://lib/scheduler.ts#L8-L85)
- [reminder-jobs.ts](file://lib/reminder-jobs.ts#L77-L97)
- [api/scheduler/run/route.ts](file://app/api/scheduler/run/route.ts#L8-L17)

## 安全考虑

系统实施多层安全措施：使用JWT验证用户身份，通过Zod验证输入数据，敏感操作需要身份验证。订阅数据与用户ID绑定，防止跨用户访问。环境变量存储VAPID私钥，避免泄露。

```mermaid
graph TD
A[安全措施] --> B[身份验证]
A --> C[输入验证]
A --> D[数据隔离]
A --> E[密钥管理]
B --> B1[JWT令牌验证]
B --> B2[Cookie认证]
C --> C1[Zod模式验证]
C --> C2[端点URL校验]
D --> D1[用户ID绑定]
D --> D2[权限检查]
E --> E1[环境变量存储]
E --> E2[私钥不暴露]
style A fill:#f96,stroke:#333,color:white
style B fill:#6f9,stroke:#333
style C fill:#6f9,stroke:#333
style D fill:#6f9,stroke:#333
style E fill:#6f9,stroke:#333
```

**Diagram sources**
- [subscribe/route.ts](file://app/api/push/subscribe/route.ts#L16-L24)
- [web-push.ts](file://lib/web-push.ts#L5-L7)
- [schema.prisma](file://prisma/schema.prisma#L78-L79)

**Section sources**
- [subscribe/route.ts](file://app/api/push/subscribe/route.ts#L16-L24)
- [web-push.ts](file://lib/web-push.ts#L5-L7)
- [schema.prisma](file://prisma/schema.prisma#L78-L79)

## 架构概览

系统采用分层架构，前端通过服务工作线程处理推送，后端API处理订阅管理，调度器驱动提醒发送。所有组件通过清晰的接口交互，确保可维护性和扩展性。

```mermaid
graph TD
subgraph "客户端"
UI[用户界面]
SW[服务工作线程]
end
subgraph "服务端"
API[API网关]
Service[推送服务]
Scheduler[调度器]
DB[(数据库)]
end
UI --> SW
UI --> API
API --> Service
API --> DB
Scheduler --> Service
Service --> DB
SW --> UI
style UI fill:#bbf,stroke:#333
style SW fill:#f9f,stroke:#333
style API fill:#f96,stroke:#333
style Service fill:#6f9,stroke:#333
style Scheduler fill:#6f9,stroke:#333
style DB fill:#69f,stroke:#333
```

**Diagram sources**
- [sw.js](file://public/sw.js)
- [web-push.ts](file://lib/web-push.ts)
- [scheduler.ts](file://lib/scheduler.ts)
- [schema.prisma](file://prisma/schema.prisma)

**Section sources**
- [sw.js](file://public/sw.js)
- [web-push.ts](file://lib/web-push.ts)
- [scheduler.ts](file://lib/scheduler.ts)
- [schema.prisma](file://prisma/schema.prisma)

## 依赖分析

系统依赖关系清晰，核心依赖包括web-push库、Prisma ORM和Next.js框架。web-push封装提供推送功能，Prisma管理数据库交互，Next.js提供API路由和SSR支持。

```mermaid
dependency-graph
"web-push.ts" --> "web-push"
"subscribe/route.ts" --> "prisma"
"subscribe/route.ts" --> "zod"
"scheduler.ts" --> "web-push.ts"
"scheduler.ts" --> "prisma"
"scheduler.ts" --> "reminder-jobs.ts"
"reminder-jobs.ts" --> "prisma"
"ServiceWorkerRegistration.tsx" --> "sw.js"
"settings/page.tsx" --> "web-push.ts"
"settings/page.tsx" --> "sw.js"
"web-push" --> "node:crypto"
"prisma" --> "postgresql"
style "web-push.ts" fill:#6f9,stroke:#333
style "subscribe/route.ts" fill:#f96,stroke:#333
style "scheduler.ts" fill:#6f9,stroke:#333
style "reminder-jobs.ts" fill:#6f9,stroke:#333
style "web-push" fill:#f9f,stroke:#333
style "prisma" fill:#69f,stroke:#333
```

**Diagram sources**
- [package.json](file://package.json)
- [web-push.ts](file://lib/web-push.ts)
- [subscribe/route.ts](file://app/api/push/subscribe/route.ts)
- [scheduler.ts](file://lib/scheduler.ts)
- [reminder-jobs.ts](file://lib/reminder-jobs.ts)

**Section sources**
- [package.json](file://package.json)
- [web-push.ts](file://lib/web-push.ts)
- [subscribe/route.ts](file://app/api/push/subscribe/route.ts)
- [scheduler.ts](file://lib/scheduler.ts)
- [reminder-jobs.ts](file://lib/reminder-jobs.ts)