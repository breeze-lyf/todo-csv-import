# Web Push 调试指南

## 问题排查步骤

### 1. 检查浏览器控制台

打开浏览器开发者工具（F12），查看 Console 标签页，应该看到：

```
[SW] Checking Service Worker support...
[SW] Service Worker supported, registering...
[SW] Service Worker registered successfully: http://localhost:3000/
[SW] Registration state: activated
```

### 2. 检查 Service Worker 状态

在浏览器开发者工具中：
- Chrome: Application → Service Workers
- Firefox: about:debugging#/runtime/this-firefox → Service Workers

应该看到 `/sw.js` 已注册并激活。

### 3. 检查 HTTPS 要求

Web Push 需要 HTTPS（localhost 除外）。确保：
- 开发环境：使用 `localhost` 或 `127.0.0.1`
- 生产环境：必须使用 HTTPS

### 4. 测试权限请求

访问 Settings 页面，点击 "Enable Notifications"，控制台应显示：

```
[Push] Starting notification permission request...
[Push] Current permission: default
[Push] Requesting permission...
[Push] Permission result: granted
[Push] Waiting for Service Worker...
[Push] Service Worker ready: [ServiceWorkerRegistration]
[Push] Fetching VAPID public key...
[Push] VAPID public key received: BBbpw--mPlG7KsMnAAGh...
[Push] Subscribing to push notifications...
[Push] Subscription created: https://...
[Push] Sending subscription to server...
[Push] Subscription saved successfully!
```

### 5. 常见问题

#### 问题：Service Worker 未注册
**解决方案**：
- 清除浏览器缓存
- 重启开发服务器
- 检查 `/public/sw.js` 文件是否存在

#### 问题：权限请求未弹出
**解决方案**：
- 检查浏览器是否已拒绝权限（地址栏左侧图标）
- 重置网站权限：Chrome Settings → Privacy → Site Settings
- 尝试使用隐身模式

#### 问题：VAPID key 错误
**解决方案**：
- 检查 `.env` 文件中的 VAPID keys
- 确保 `NEXT_PUBLIC_VAPID_PUBLIC_KEY` 有 `NEXT_PUBLIC_` 前缀
- 重启开发服务器

### 6. 手动测试推送

在浏览器控制台运行：

```javascript
// 检查权限
console.log('Permission:', Notification.permission)

// 检查 Service Worker
navigator.serviceWorker.ready.then(reg => {
  console.log('SW Ready:', reg)
  return reg.pushManager.getSubscription()
}).then(sub => {
  console.log('Subscription:', sub)
})

// 发送测试通知
new Notification('Test', { body: 'This is a test notification' })
```

### 7. 测试完整流程

1. 访问 `/settings`
2. 点击 "Enable Notifications"
3. 允许浏览器权限
4. 创建一个事件（日期设为明天）
5. 创建提醒规则（提前 0 天，当前时间）
6. 手动触发 Scheduler：
   ```bash
   curl -X POST http://localhost:3000/api/scheduler/run
   ```
7. 应该收到推送通知

### 8. 浏览器兼容性

| 浏览器 | 支持 | 注意事项 |
|--------|------|----------|
| Chrome | ✅ | 完全支持 |
| Firefox | ✅ | 完全支持 |
| Edge | ✅ | 完全支持 |
| Safari (macOS) | ✅ | macOS 13+ |
| Safari (iOS) | ⚠️ | 需要添加到主屏幕 |

### 9. 生产环境检查清单

- [ ] HTTPS 已启用
- [ ] VAPID keys 已配置
- [ ] Service Worker 已注册
- [ ] Cron Job 已配置
- [ ] 数据库已同步
- [ ] 环境变量已设置

## 需要帮助？

如果以上步骤都无法解决问题，请提供：
1. 浏览器控制台完整日志
2. Service Worker 状态截图
3. 浏览器和版本信息
