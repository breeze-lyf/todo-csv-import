# API参考

<cite>
**本文档中引用的文件**  
- [login/route.ts](file://app/api/auth/login/route.ts)
- [register/route.ts](file://app/api/auth/register/route.ts)
- [logout/route.ts](file://app/api/auth/logout/route.ts)
- [events/route.ts](file://app/api/events/route.ts)
- [events/[id]/route.ts](file://app/api/events/[id]/route.ts)
- [events/bulk-create/route.ts](file://app/api/events/bulk-create/route.ts)
- [reminder-rules/route.ts](file://app/api/reminder-rules/route.ts)
- [reminder-rules/[id]/route.ts](file://app/api/reminder-rules/[id]/route.ts)
- [push/subscribe/route.ts](file://app/api/push/subscribe/route.ts)
- [push/vapid-public-key/route.ts](file://app/api/push/vapid-public-key/route.ts)
- [scheduler/run/route.ts](file://app/api/scheduler/run/route.ts)
- [auth.ts](file://lib/auth.ts)
- [web-push.ts](file://lib/web-push.ts)
- [schema.prisma](file://prisma/schema.prisma)
</cite>

## 目录
1. [认证接口](#认证接口)
2. [事件管理接口](#事件管理接口)
3. [提醒规则接口](#提醒规则接口)
4. [推送订阅接口](#推送订阅接口)
5. [调度接口](#调度接口)

## 认证接口

本节描述 `/api/auth/*` 路径下的认证相关API端点，包括用户登录、注册和登出功能。所有认证操作通过JWT令牌实现状态管理，令牌通过HTTP-only Cookie返回客户端。

### 登录接口

#### 端点
`POST /api/auth/login`

#### 功能说明
验证用户凭据并生成JWT令牌。成功后将令牌写入名为 `token` 的HTTP-only Cookie中。

#### 请求参数
```json
{
  "email": "string",
  "password": "string"
}
```

- `email`: 必需，有效的电子邮件格式
- `password`: 必需，任意长度字符串

#### 响应格式
成功响应（200）：
```json
{
  "success": true,
  "user": {
    "id": "string",
    "email": "string"
  }
}
```

错误响应（400/401）：
```json
{
  "error": "Invalid input | Invalid credentials"
}
```

#### 状态码
- `200`: 登录成功
- `400`: 输入无效
- `401`: 凭据无效
- `500`: 服务器内部错误

#### curl示例
```bash
curl -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

#### 错误处理指南
- 检查请求体是否包含正确的email和password字段
- 确保email格式正确
- 用户不存在或密码错误均返回401状态码
- 服务器错误会在日志中记录详细信息

**Section sources**
- [login/route.ts](file://app/api/auth/login/route.ts#L1-L57)

### 注册接口

#### 端点
`POST /api/auth/register`

#### 功能说明
创建新用户账户。密码自动哈希存储，成功后返回用户基本信息。

#### 请求参数
```json
{
  "email": "string",
  "password": "string"
}
```

- `email`: 必需，唯一且符合电子邮件格式
- `password`: 必需，至少6个字符

#### 响应格式
成功响应（201）：
```json
{
  "user": {
    "id": "string",
    "email": "string",
    "createdAt": "datetime"
  }
}
```

错误响应：
```json
{
  "error": "Invalid input | User already exists | Internal Server Error"
}
```

#### 状态码
- `201`: 用户创建成功
- `400`: 输入无效或用户已存在
- `500`: 服务器内部错误

#### curl示例
```bash
curl -X POST https://your-domain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"newuser@example.com","password":"password123"}'
```

#### 错误处理指南
- 邮箱已被注册时返回400错误
- 密码长度不足6位时验证失败
- 服务器错误包含详细错误消息

**Section sources**
- [register/route.ts](file://app/api/auth/register/route.ts#L1-L53)

### 登出接口

#### 端点
`POST /api/auth/logout`

#### 功能说明
清除客户端的JWT令牌Cookie，实现安全登出。

#### 请求参数
无请求体

#### 响应格式
```json
{
  "success": true
}
```

#### 状态码
- `200`: 登出成功
- `500`: 服务器内部错误

#### curl示例
```bash
curl -X POST https://your-domain.com/api/auth/logout
```

#### 错误处理指南
此端点极少出错，主要确保Cookie设置正确清除。

**Section sources**
- [logout/route.ts](file://app/api/auth/logout/route.ts#L1-L14)

## 事件管理接口

本节描述 `/api/events/*` 路径下的事件管理API，支持单个和批量事件操作。

### 获取事件列表

#### 端点
`GET /api/events`

#### 功能说明
获取指定月份的所有事件及其关联的提醒实例。系统会根据用户的提醒规则自动生成虚拟提醒事件。

#### 请求参数
查询参数：
- `month`: YYYY-MM格式的月份字符串（必需）

#### 响应格式
```json
{
  "events": [
    {
      "id": "string",
      "title": "string",
      "date": "YYYY-MM-DD",
      "time": "HH:mm|null",
      "label": "string|null",
      "notes": "string|null",
      "isReminder": false,
      "reminderDaysOffset": null,
      "originalEventId": "string",
      "displayDate": "YYYY-MM-DD"
    },
    {
      "id": "string-reminder-7",
      "title": "string",
      "date": "YYYY-MM-DD",
      "time": "HH:mm|null",
      "label": "string|null",
      "notes": "string|null",
      "isReminder": true,
      "reminderDaysOffset": 7,
      "originalEventId": "string",
      "displayDate": "YYYY-MM-DD"
    }
  ]
}
```

#### 状态码
- `200`: 获取成功
- `400`: 月份格式无效
- `401`: 未授权访问
- `500`: 服务器内部错误

#### curl示例
```bash
curl -X GET "https://your-domain.com/api/events?month=2024-01" \
  -H "Cookie: token=your-jwt-token"
```

#### 错误处理指南
- 确保请求包含有效的JWT令牌Cookie
- 月份参数必须为YYYY-MM格式
- 日期计算考虑了避免周末的规则

**Section sources**
- [events/route.ts](file://app/api/events/route.ts#L1-L128)

### 创建/更新事件

#### 端点
`POST /api/events`

#### 功能说明
创建新事件或更新现有同名事件。如果标题已存在则执行更新操作。

#### 请求参数
```json
{
  "title": "string",
  "date": "YYYY-MM-DD",
  "time": "HH:mm|null",
  "label": "string|null",
  "notes": "string|null"
}
```

#### 响应格式
创建成功（201）：
```json
{
  "event": { /* event object */ },
  "replaced": false
}
```

更新成功（200）：
```json
{
  "event": { /* event object */ },
  "replaced": true
}
```

验证失败（400）：
```json
{
  "error": "Invalid input",
  "details": { /* zod validation error */ }
}
```

#### 状态码
- `200`: 事件更新成功
- `201`: 事件创建成功
- `400`: 输入无效
- `401`: 未授权访问
- `500`: 服务器内部错误

#### curl示例
```bash
curl -X POST https://your-domain.com/api/events \
  -H "Content-Type: application/json" \
  -H "Cookie: token=your-jwt-token" \
  -d '{
    "title": "团队会议",
    "date": "2024-01-15",
    "time": "14:00",
    "label": "工作"
  }'
```

#### 错误处理指南
- 时间字段可为空，默认使用10:00
- 日期格式必须为YYYY-MM-DD
- 系统自动处理时区为Asia/Shanghai (+08:00)

**Section sources**
- [events/route.ts](file://app/api/events/route.ts#L131-L198)

### 批量创建事件

#### 端点
`POST /api/events/bulk-create`

#### 功能说明
批量导入多个事件，常用于CSV文件导入场景。

#### 请求参数
```json
{
  "events": [
    {
      "title": "string",
      "date": "YYYY-MM-DD|YYYY/MM/DD",
      "time": "H:MM|HH:MM",
      "label": "string",
      "notes": "string"
    }
  ]
}
```

支持多种日期/时间格式输入，系统会自动标准化。

#### 响应格式
```json
{
  "success": true,
  "created": 5,
  "updated": 3,
  "failed": 1,
  "errors": [
    {
      "index": 0,
      "title": "string",
      "error": "string"
    }
  ]
}
```

#### 状态码
- `201`: 批量处理成功
- `400`: 输入无效
- `401`: 未授权访问
- `500`: 服务器内部错误

#### curl示例
```bash
curl -X POST https://your-domain.com/api/events/bulk-create \
  -H "Content-Type: application/json" \
  -H "Cookie: token=your-jwt-token" \
  -d '{
    "events": [
      {
        "title": "项目启动",
        "date": "2024-01-10",
        "time": "9:30"
      },
      {
        "title": "中期评审",
        "date": "2024/01/25",
        "time": "14:00"
      }
    ]
  }'
```

#### 错误处理指南
- 返回详细的失败索引和原因
- 系统自动处理日期分隔符差异
- 同一批次中重复标题会按顺序覆盖

**Section sources**
- [events/bulk-create/route.ts](file://app/api/events/bulk-create/route.ts#L1-L132)

### 获取单个事件

#### 端点
`GET /api/events/[id]`

#### 功能说明
获取指定ID的单个事件详情。

#### 请求参数
路径参数：
- `id`: 事件唯一标识符

#### 响应格式
成功响应：
```json
{
  "event": { /* event object */ }
}
```

#### 状态码
- `200`: 获取成功
- `400`: ID缺失
- `401`: 未授权访问
- `403`: 禁止访问（非本人事件）
- `404`: 事件不存在
- `500`: 服务器内部错误

**Section sources**
- [events/[id]/route.ts](file://app/api/events/[id]/route.ts#L1-L119)

### 更新事件

#### 端点
`PUT /api/events/[id]`

#### 功能说明
更新指定ID的事件信息，并重新生成相关提醒任务。

#### 请求参数
```json
{
  "title": "string",
  "date": "YYYY-MM-DD",
  "time": "HH:mm|null",
  "label": "string|null",
  "notes": "string|null"
}
```

所有字段均为可选。

#### 响应格式
```json
{
  "event": { /* updated event object */ }
}
```

#### 状态码
- `200`: 更新成功
- `400`: 输入无效或ID缺失
- `401`: 未授权访问
- `403`: 禁止访问
- `404`: 事件不存在
- `500`: 服务器内部错误

#### curl示例
```bash
curl -X PUT https://your-domain.com/api/events/event123 \
  -H "Content-Type: application/json" \
  -H "Cookie: token=your-jwt-token" \
  -d '{
    "time": "15:30",
    "notes": "会议室已预订"
  }'
```

**Section sources**
- [events/[id]/route.ts](file://app/api/events/[id]/route.ts#L15-L73)

### 删除事件

#### 端点
`DELETE /api/events/[id]`

#### 功能说明
删除指定ID的事件及其所有关联提醒任务。

#### 请求参数
路径参数：
- `id`: 事件唯一标识符

#### 响应格式
```json
{
  "success": true
}
```

#### 状态码
- `200`: 删除成功
- `400`: ID缺失
- `401`: 未授权访问
- `403`: 禁止访问
- `404`: 事件不存在
- `500`: 服务器内部错误

#### curl示例
```bash
curl -X DELETE https://your-domain.com/api/events/event123 \
  -H "Cookie: token=your-jwt-token"
```

**Section sources**
- [events/[id]/route.ts](file://app/api/events/[id]/route.ts#L76-L118)

## 提醒规则接口

本节描述 `/api/reminder-rules/*` 路径下的提醒规则管理API。

### 获取提醒规则列表

#### 端点
`GET /api/reminder-rules`

#### 功能说明
获取当前用户的所有提醒规则。

#### 请求参数
无

#### 响应格式
```json
{
  "rules": [
    {
      "id": "string",
      "userId": "string",
      "label": "string",
      "offsetsInDays": [7, 3, 1],
      "defaultTime": "10:00",
      "avoidWeekends": true,
      "createdAt": "datetime",
      "updatedAt": "datetime"
    }
  ]
}
```

#### 状态码
- `200`: 获取成功
- `401`: 未授权访问
- `500`: 服务器内部错误

**Section sources**
- [reminder-rules/route.ts](file://app/api/reminder-rules/route.ts#L13-L38)

### 创建提醒规则

#### 端点
`POST /api/reminder-rules`

#### 功能说明
为特定标签创建提醒规则。创建后会自动为现有匹配事件生成提醒任务。

#### 请求参数
```json
{
  "label": "string",
  "offsetsInDays": [number],
  "defaultTime": "HH:mm",
  "avoidWeekends": boolean
}
```

- `offsetsInDays`: 提前天数数组，非负整数
- `defaultTime`: 默认提醒时间
- `avoidWeekends`: 是否避开周末

#### 响应格式
```json
{
  "rule": { /* rule object */ }
}
```

#### 状态码
- `201`: 创建成功
- `400`: 输入无效或标签已存在
- `401`: 未授权访问
- `500`: 服务器内部错误

#### curl示例
```bash
curl -X POST https://your-domain.com/api/reminder-rules \
  -H "Content-Type: application/json" \
  -H "Cookie: token=your-jwt-token" \
  -d '{
    "label": "账单",
    "offsetsInDays": [7, 3, 1],
    "defaultTime": "09:00",
    "avoidWeekends": true
  }'
```

#### 错误处理指南
- 同一用户不能有相同标签的多个规则
- 系统自动验证时间格式

**Section sources**
- [reminder-rules/route.ts](file://app/api/reminder-rules/route.ts#L41-L108)

### 更新提醒规则

#### 端点
`PUT /api/reminder-rules/[id]`

#### 功能说明
更新指定ID的提醒规则，并同步影响所有相关事件的提醒任务。

#### 请求参数
```json
{
  "label": "string",
  "offsetsInDays": [number],
  "defaultTime": "HH:mm",
  "avoidWeekends": boolean
}
```

所有字段可选。

#### 响应格式
```json
{
  "rule": { /* updated rule object */ }
}
```

#### 状态码
- `200`: 更新成功
- `400`: 输入无效或ID缺失
- `401`: 未授权访问
- `403`: 禁止访问
- `404`: 规则不存在
- `500`: 服务器内部错误

#### curl示例
```bash
curl -X PUT https://your-domain.com/api/reminder-rules/rule123 \
  -H "Content-Type: application/json" \
  -H "Cookie: token=your-jwt-token" \
  -d '{
    "offsetsInDays": [5, 2]
  }'
```

**Section sources**
- [reminder-rules/[id]/route.ts](file://app/api/reminder-rules/[id]/route.ts#L13-L91)

### 删除提醒规则

#### 端点
`DELETE /api/reminder-rules/[id]`

#### 功能说明
删除指定ID的提醒规则，相关事件将回退到默认提醒规则。

#### 请求参数
路径参数：
- `id`: 规则唯一标识符

#### 响应格式
```json
{
  "success": true
}
```

#### 状态码
- `200`: 删除成功
- `400`: ID缺失
- `401`: 未授权访问
- `403`: 禁止访问
- `404`: 规则不存在
- `500`: 服务器内部错误

#### curl示例
```bash
curl -X DELETE https://your-domain.com/api/reminder-rules/rule123 \
  -H "Cookie: token=your-jwt-token"
```

**Section sources**
- [reminder-rules/[id]/route.ts](file://app/api/reminder-rules/[id]/route.ts#L94-L157)

## 推送订阅接口

本节描述Web Push相关的API端点。

### 获取VAPID公钥

#### 端点
`GET /api/push/vapid-public-key`

#### 功能说明
获取用于Web Push订阅的VAPID公钥。

#### 请求参数
无

#### 响应格式
```json
{
  "publicKey": "string"
}
```

#### 状态码
- `200`: 获取成功
- `500`: VAPID密钥未配置

#### curl示例
```bash
curl -X GET https://your-domain.com/api/push/vapid-public-key
```

**Section sources**
- [vapid-public-key/route.ts](file://app/api/push/vapid-public-key/route.ts#L4-L12)

### 订阅推送通知

#### 端点
`POST /api/push/subscribe`

#### 功能说明
保存用户的推送订阅信息到数据库。

#### 请求参数
```json
{
  "endpoint": "string",
  "keys": {
    "p256dh": "string",
    "auth": "string"
  }
}
```

#### 响应格式
新订阅（201）：
```json
{
  "subscription": { /* subscription object */ }
}
```

已存在（200）：
```json
{
  "subscription": { /* existing subscription */ }
}
```

#### 状态码
- `200`: 订阅已存在
- `201`: 新订阅创建成功
- `400`: 输入无效
- `401`: 未授权访问
- `500`: 服务器内部错误

#### curl示例
```bash
curl -X POST https://your-domain.com/api/push/subscribe \
  -H "Content-Type: application/json" \
  -H "Cookie: token=your-jwt-token" \
  -d '{
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "keys": {
      "p256dh": "BNcRdreN...YRjSo=",
      "auth": "tIaBaR..."
    }
  }'
```

**Section sources**
- [subscribe/route.ts](file://app/api/push/subscribe/route.ts#L14-L62)

### 取消推送订阅

#### 端点
`DELETE /api/push/subscribe`

#### 功能说明
删除用户的推送订阅。

#### 请求参数
查询参数：
- `endpoint`: 要取消的订阅端点URL

#### 响应格式
```json
{
  "success": true
}
```

#### 状态码
- `200`: 取消成功
- `400`: 缺少endpoint参数
- `401`: 未授权访问
- `500`: 服务器内部错误

#### curl示例
```bash
curl -X DELETE "https://your-domain.com/api/push/subscribe?endpoint=https%3A%2F%2Ffcm.googleapis.com%2Ffcm%2Fsend%2F..." \
  -H "Cookie: token=your-jwt-token"
```

**Section sources**
- [subscribe/route.ts](file://app/api/push/subscribe/route.ts#L64-L95)

## 调度接口

本节描述定时任务调度相关的API。

### 运行调度器

#### 端点
`POST /api/scheduler/run`

#### 功能说明
手动触发提醒调度器，发送所有待处理的提醒通知。

#### 安全调用方式
此端点应通过Cron作业定期调用。建议：
- 添加秘密令牌验证
- 限制IP访问
- 使用HTTPS
- 避免公开暴露

#### 请求参数
无请求体

#### 响应格式
```json
{
  "success": true,
  "processed": 5
}
```

#### 状态码
- `200`: 调度成功
- `500`: 调度失败

#### curl示例
```bash
curl -X POST https://your-domain.com/api/scheduler/run
```

#### 检查调度器状态

`GET /api/scheduler/run` 返回就绪状态信息，可用于健康检查。

**Section sources**
- [scheduler/run/route.ts](file://app/api/scheduler/run/route.ts#L8-L36)