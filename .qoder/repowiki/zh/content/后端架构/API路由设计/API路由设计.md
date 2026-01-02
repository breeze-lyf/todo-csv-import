# API路由设计

<cite>
**本文档中引用的文件**  
- [events/route.ts](file://app/api/events/route.ts)
- [events/[id]/route.ts](file://app/api/events/[id]/route.ts)
- [events/bulk-create/route.ts](file://app/api/events/bulk-create/route.ts)
- [auth/login/route.ts](file://app/api/auth/login/route.ts)
- [auth/register/route.ts](file://app/api/auth/register/route.ts)
- [auth/logout/route.ts](file://app/api/auth/logout/route.ts)
- [reminder-rules/route.ts](file://app/api/reminder-rules/route.ts)
- [reminder-rules/[id]/route.ts](file://app/api/reminder-rules/[id]/route.ts)
- [push/subscribe/route.ts](file://app/api/push/subscribe/route.ts)
- [push/vapid-public-key/route.ts](file://app/api/push/vapid-public-key/route.ts)
- [scheduler/run/route.ts](file://app/api/scheduler/run/route.ts)
- [auth.ts](file://lib/auth.ts)
- [scheduler.ts](file://lib/scheduler.ts)
- [reminder-jobs.ts](file://lib/reminder-jobs.ts)
- [web-push.ts](file://lib/web-push.ts)
</cite>

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构概述](#架构概述)
5. [详细组件分析](#详细组件分析)
6. [依赖分析](#依赖分析)
7. [性能考虑](#性能考虑)
8. [故障排除指南](#故障排除指南)
9. [结论](#结论)

## 简介
本项目是一个基于Next.js App Router的待办事项系统，支持CSV批量导入事件、提醒规则配置、Web推送通知和定时调度功能。API设计遵循RESTful原则，通过JWT实现用户认证，使用Prisma进行数据库操作，并集成Web Push API实现浏览器通知。系统核心功能包括事件管理、用户认证、提醒规则、推送订阅和调度器触发。

## 项目结构
项目采用标准的Next.js App Router目录结构，API路由集中于`app/api`目录下，按功能模块组织。前端页面与API端点分离，便于维护和扩展。

```mermaid
graph TB
subgraph "API Endpoints"
A["auth/login"]
B["auth/register"]
C["auth/logout"]
D["events"]
E["events/[id]"]
F["events/bulk-create"]
G["reminder-rules"]
H["reminder-rules/[id]"]
I["push/subscribe"]
J["push/vapid-public-key"]
K["scheduler/run"]
end
subgraph "Core Modules"
L["lib/auth.ts"]
M["lib/prisma.ts"]
N["lib/scheduler.ts"]
O["lib/reminder-jobs.ts"]
P["lib/web-push.ts"]
end
A --> L
B --> L
C --> L
D --> N
E --> N
F --> N
G --> O
H --> O
I --> P
J --> P
K --> N
```

**Diagram sources**
- [app/api](file://app/api)
- [lib](file://lib)

**Section sources**
- [app/api](file://app/api)
- [lib](file://lib)

## 核心组件
系统核心组件包括事件管理、用户认证、提醒规则、推送订阅和调度器五大模块。所有API端点均通过JWT进行身份验证，使用Zod进行请求数据验证，确保接口安全性和数据完整性。

**Section sources**
- [events/route.ts](file://app/api/events/route.ts)
- [auth/login/route.ts](file://app/api/auth/login/route.ts)
- [reminder-rules/route.ts](file://app/api/reminder-rules/route.ts)
- [push/subscribe/route.ts](file://app/api/push/subscribe/route.ts)
- [scheduler/run/route.ts](file://app/api/scheduler/run/route.ts)

## 架构概述
系统采用分层架构设计，前端通过API路由与后端交互，后端服务通过业务逻辑层调用数据访问层。认证、提醒生成、推送通知等公共功能封装为独立模块，提高代码复用性。

```mermaid
graph TD
A[前端页面] --> B[API路由]
B --> C[业务逻辑]
C --> D[数据访问]
D --> E[数据库]
C --> F[外部服务]
B --> G[认证中间件]
C --> H[提醒作业生成]
C --> I[推送通知服务]
F --> J[Web Push]
```

**Diagram sources**
- [app/api](file://app/api)
- [lib](file://lib)
- [prisma/schema.prisma](file://prisma/schema.prisma)

## 详细组件分析

### 事件管理分析
事件管理API提供创建、读取、更新、删除和批量创建功能，支持基于标签的智能提醒。

#### 事件创建与读取
```mermaid
sequenceDiagram
participant Client as "客户端"
participant API as "API路由"
participant Auth as "认证服务"
participant DB as "数据库"
Client->>API : POST /api/events
API->>Auth : 验证JWT令牌
Auth-->>API : 用户身份
API->>API : 验证请求数据
API->>DB : 创建/更新事件
DB-->>API : 事件对象
API->>API : 生成提醒作业
API-->>Client : 返回事件
```

**Diagram sources**
- [events/route.ts](file://app/api/events/route.ts#L131-L200)
- [lib/auth.ts](file://lib/auth.ts#L22-L30)
- [lib/reminder-jobs.ts](file://lib/reminder-jobs.ts#L15-L72)

#### 动态路由[id]实现
```mermaid
flowchart TD
Start([接收请求]) --> ExtractID["提取路径参数id"]
ExtractID --> ValidateAuth["验证用户身份"]
ValidateAuth --> CheckOwnership["检查事件所有权"]
CheckOwnership --> ProcessRequest{"请求类型"}
ProcessRequest --> |PUT| UpdateEvent["更新事件数据"]
ProcessRequest --> |DELETE| DeleteEvent["删除事件"]
UpdateEvent --> RegenerateJobs["重新生成提醒作业"]
DeleteEvent --> RemoveJobs["清除提醒作业"]
RegenerateJobs --> ReturnSuccess["返回成功响应"]
RemoveJobs --> ReturnSuccess
ReturnSuccess --> End([响应客户端])
```

**Diagram sources**
- [events/[id]/route.ts](file://app/api/events/[id]/route.ts)
- [lib/reminder-jobs.ts](file://lib/reminder-jobs.ts#L15-L72)

**Section sources**
- [events/[id]/route.ts](file://app/api/events/[id]/route.ts)
- [lib/reminder-jobs.ts](file://lib/reminder-jobs.ts)

#### 批量创建CSV导入
```mermaid
flowchart TD
Start([POST /bulk-create]) --> Auth["验证用户身份"]
Auth --> Validate["验证批量数据"]
Validate --> Prefetch["预取现有事件"]
Prefetch --> Loop["遍历每个事件"]
Loop --> Normalize["标准化日期时间"]
Normalize --> CheckExist["检查是否已存在"]
CheckExist --> |存在| Update["更新事件"]
CheckExist --> |不存在| Create["创建事件"]
Update --> GenerateJob["生成提醒作业"]
Create --> GenerateJob
GenerateJob --> UpdateMap["更新标题映射"]
UpdateMap --> NextEvent["处理下一个"]
NextEvent --> Loop
Loop --> |完成| ReturnResult["返回结果统计"]
ReturnResult --> End([响应客户端])
```

**Diagram sources**
- [events/bulk-create/route.ts](file://app/api/events/bulk-create/route.ts)
- [lib/reminder-jobs.ts](file://lib/reminder-jobs.ts#L15-L72)

**Section sources**
- [events/bulk-create/route.ts](file://app/api/events/bulk-create/route.ts)
- [lib/reminder-jobs.ts](file://lib/reminder-jobs.ts)

### 用户认证分析
用户认证系统基于JWT实现，通过HTTP-only cookie存储令牌，提高安全性。

```mermaid
sequenceDiagram
participant Client as "客户端"
participant LoginAPI as "登录API"
participant Auth as "认证服务"
participant DB as "数据库"
Client->>LoginAPI : 提交邮箱密码
LoginAPI->>DB : 查询用户
DB-->>LoginAPI : 用户数据
LoginAPI->>Auth : 验证密码
Auth-->>LoginAPI : 验证结果
LoginAPI->>Auth : 生成JWT令牌
Auth-->>LoginAPI : JWT令牌
LoginAPI->>Client : 设置cookie并响应
```

**Diagram sources**
- [auth/login/route.ts](file://app/api/auth/login/route.ts)
- [lib/auth.ts](file://lib/auth.ts)

**Section sources**
- [auth/login/route.ts](file://app/api/auth/login/route.ts)
- [auth/register/route.ts](file://app/api/auth/register/route.ts)
- [auth/logout/route.ts](file://app/api/auth/logout/route.ts)

### 提醒规则分析
提醒规则系统允许用户为不同标签配置个性化的提醒策略。

```mermaid
classDiagram
class ReminderRule {
+string id
+string userId
+string label
+number[] offsetsInDays
+string defaultTime
+boolean avoidWeekends
+datetime createdAt
}
class Event {
+string id
+string userId
+string title
+string date
+string time
+string label
+string notes
}
class ReminderJob {
+string id
+string userId
+string eventId
+datetime fireTime
+boolean sent
}
ReminderRule --> Event : "标签匹配"
Event --> ReminderJob : "生成"
User --> ReminderRule : "拥有"
User --> Event : "拥有"
User --> ReminderJob : "关联"
```

**Diagram sources**
- [reminder-rules/route.ts](file://app/api/reminder-rules/route.ts)
- [reminder-rules/[id]/route.ts](file://app/api/reminder-rules/[id]/route.ts)
- [lib/reminder-jobs.ts](file://lib/reminder-jobs.ts)

**Section sources**
- [reminder-rules/route.ts](file://app/api/reminder-rules/route.ts)
- [reminder-rules/[id]/route.ts](file://app/api/reminder-rules/[id]/route.ts)

### 推送订阅分析
推送订阅系统基于Web Push API实现，管理用户的浏览器推送权限和订阅信息。

```mermaid
sequenceDiagram
participant Client as "客户端"
participant SubscribeAPI as "订阅API"
participant DB as "数据库"
Client->>SubscribeAPI : 发送订阅信息
SubscribeAPI->>DB : 检查是否已订阅
DB-->>SubscribeAPI : 订阅状态
alt 已存在
SubscribeAPI-->>Client : 返回现有订阅
else 不存在
SubscribeAPI->>DB : 创建新订阅
DB-->>SubscribeAPI : 新订阅
SubscribeAPI-->>Client : 返回新订阅
end
```

**Diagram sources**
- [push/subscribe/route.ts](file://app/api/push/subscribe/route.ts)
- [lib/web-push.ts](file://lib/web-push.ts)

**Section sources**
- [push/subscribe/route.ts](file://app/api/push/subscribe/route.ts)
- [push/vapid-public-key/route.ts](file://app/api/push/vapid-public-key/route.ts)

### 调度器分析
调度器作为外部Cron触发入口，负责发送待处理的提醒通知。

```mermaid
flowchart TD
Start([POST /scheduler/run]) --> Auth["认证检查"]
Auth --> GetJobs["获取待处理作业"]
GetJobs --> Loop["遍历每个作业"]
Loop --> GetSubs["获取用户订阅"]
GetSubs --> SendPush["发送推送通知"]
SendPush --> HandleResult{"发送结果"}
HandleResult --> |失败| CheckError{"错误类型"}
CheckError --> |410| RemoveSub["删除无效订阅"]
HandleResult --> |成功| MarkSent["标记为已发送"]
MarkSent --> NextJob["处理下一个"]
NextJob --> Loop
Loop --> |完成| ReturnResult["返回处理统计"]
ReturnResult --> End([响应客户端])
```

**Diagram sources**
- [scheduler/run/route.ts](file://app/api/scheduler/run/route.ts)
- [lib/scheduler.ts](file://lib/scheduler.ts)
- [lib/reminder-jobs.ts](file://lib/reminder-jobs.ts)

**Section sources**
- [scheduler/run/route.ts](file://app/api/scheduler/run/route.ts)
- [lib/scheduler.ts](file://lib/scheduler.ts)

## 依赖分析
系统依赖关系清晰，各模块职责分明，通过接口隔离降低耦合度。

```mermaid
graph TD
A[API路由] --> B[认证服务]
A --> C[业务逻辑]
A --> D[数据库]
C --> D
C --> E[推送服务]
E --> F[Web Push]
B --> G[JWT]
D --> H[Prisma]
style A fill:#f9f,stroke:#333
style B fill:#bbf,stroke:#333
style C fill:#f96,stroke:#333
```

**Diagram sources**
- [package.json](file://package.json)
- [app/api](file://app/api)
- [lib](file://lib)

**Section sources**
- [package.json](file://package.json)
- [lib](file://lib)

## 性能考虑
系统在设计时考虑了多项性能优化措施：
- 批量操作时预取数据减少数据库查询次数
- 使用Prisma的createMany等批量操作方法
- 提醒作业生成时先删除旧作业再批量创建
- 调度器运行时批量获取待处理作业
- 客户端分页加载事件数据

## 故障排除指南
常见错误响应格式统一，便于客户端处理：

```json
{
  "error": "错误描述",
  "details": "详细信息（可选）"
}
```

| 状态码 | 错误场景 | 处理建议 |
|--------|---------|---------|
| 400 | 参数验证失败 | 检查请求数据格式 |
| 401 | 未授权访问 | 确保已登录并携带有效令牌 |
| 403 | 禁止访问 | 检查资源所有权 |
| 404 | 资源不存在 | 验证资源ID是否正确 |
| 500 | 服务器内部错误 | 检查服务日志 |

**Section sources**
- [events/route.ts](file://app/api/events/route.ts)
- [auth/login/route.ts](file://app/api/auth/login/route.ts)
- [lib/scheduler.ts](file://lib/scheduler.ts)

## 结论
本API设计实现了完整的待办事项管理功能，具有良好的安全性、可扩展性和用户体验。通过RESTful设计原则和模块化架构，系统易于维护和扩展。建议在生产环境中为调度器端点添加额外的身份验证机制，如预共享密钥，以增强安全性。