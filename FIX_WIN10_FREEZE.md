# Win10 卡死问题修复说明

## 问题描述
安装 `video-read-along-1.0.0.exe` 后，在 Windows 10 系统上出现卡死现象。

## 根本原因分析

经过代码审查、历史问题追踪和用户任务管理器截图分析，发现以下导致卡死的主要原因：

### 🔴 1. **多进程爆炸（最关键问题）**
从用户任务管理器截图可以看到：
- **7-8个 `video-read-along` 进程同时运行**
- **每个进程占用约12-13%的CPU**
- **总CPU占用超过100%**

**根本原因：**
- 应用没有单实例锁，用户多次点击图标启动多个进程
- `activate` 事件可能触发多次窗口创建
- Electron默认允许多实例运行

### 1. **跟读模式死循环风险**
- `readAlongMode.ts` 中的 `timeupdate` 事件处理可能存在并发执行
- 冷却时间过短（500ms），在低性能机器上容易触发快速重复
- 最大运行时间过长（5分钟），异常情况下会长时间占用资源

### 2. **字幕生成阻塞UI**
- 应用启动时同步等待字幕服务启动，阻塞主进程
- 视频加载后立即自动生成字幕，FFmpeg和Whisper进程占用大量CPU/内存
- 没有文件大小限制，大视频文件会导致长时间处理

### 3. **缺少超时和资源控制**
- HTTP请求没有超时设置，可能无限等待
- 字幕生成API调用没有超时保护
- 没有防止重复生成的机制

## 修复方案

### 🔑 1. 添加单实例锁（最关键修复） (`electron/main.ts`)

```typescript
// 单实例锁，防止应用重复启动
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  // 如果已经有一个实例在运行，直接退出
  console.log('Another instance is already running, quitting...')
  app.quit()
} else {
  // 当尝试启动第二个实例时，聚焦到第一个实例的窗口
  app.on('second-instance', () => {
    console.log('Second instance attempted, focusing existing window...')
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}
```

**改进点：**
- ✅ **确保只有一个应用实例运行**
- ✅ 用户多次点击图标只会聚焦到已存在的窗口
- ✅ 从根本上解决多进程问题

### 2. 优化跟读模式 (`src/services/readAlongMode.ts`)

```typescript
// 增加冷却时间：500ms -> 1000ms
private resetCooldown: number = 1000

// 缩短最大运行时间：5分钟 -> 1分钟
private maxModeDuration: number = 60000

// 添加并发控制标志
private isProcessing: boolean = false
```

**改进点：**
- ✅ 防止 `handleTimeUpdate` 并发执行
- ✅ 增加延迟时间确保视频跳转完成（50ms -> 100ms）
- ✅ 在所有分支中正确重置 `isProcessing` 标志

### 3. 优化字幕生成逻辑 (`src/components/VideoPlayer.vue`)

```typescript
// 添加生成状态标志
const isGeneratingSubtitles = ref(false)

// 防止重复生成
if (isGeneratingSubtitles.value) {
  console.log('字幕正在生成中，跳过重复请求')
  return
}

// 添加文件大小限制（200MB）
const maxSize = 200 * 1024 * 1024
if (videoBlob.size > maxSize) {
  console.warn(`视频文件过大，跳过自动生成`)
  return
}

// 添加超时控制
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 5000) // 健康检查5秒超时
const apiTimeoutId = setTimeout(() => apiController.abort(), 600000) // API调用10分钟超时
```

**改进点：**
- ✅ 防止重复触发生成请求
- ✅ 限制大文件自动生成（>200MB跳过）
- ✅ 所有HTTP请求添加超时保护
- ✅ 即使生成失败也允许播放视频
- ✅ 首次加载延迟1秒执行，让用户先看到界面

### 4. 优化应用启动流程 (`electron/main.ts`)

```typescript
// 先创建窗口，再异步启动字幕服务
createWindow()

// 延迟1秒启动字幕服务，不阻塞UI
setTimeout(async () => {
  try {
    await subtitleService.start()
    hasStartedSubtitleService = true
  } catch (error) {
    console.error('[Main] Failed to start subtitle service:', error)
  }
}, 1000)
```

**改进点：**
- ✅ 窗口立即显示，不被字幕服务阻塞
- ✅ 字幕服务在后台异步启动
- ✅ 启动失败不影响应用运行

### 5. 优化字幕服务启动 (`electron/subtitleService.ts`)

```typescript
// 增加超时时间：10秒 -> 15秒
private async waitForServer(timeout: number = 15000): Promise<void>

// 每次健康检查添加3秒超时
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 3000)

// 降低检查频率：500ms -> 1000ms
await new Promise(resolve => setTimeout(resolve, 1000))
```

**改进点：**
- ✅ 更合理的超时设置
- ✅ 避免频繁的健康检查请求
- ✅ 每个请求都有独立的超时控制

## 测试建议

### 1. 基础功能测试
- [ ] 应用能正常启动并显示界面
- [ ] 选择视频文件后能正常播放
- [ ] 字幕能正常生成和显示
- [ ] 跟读模式能正常工作

### 2. 边界情况测试
- [ ] 选择超大视频文件（>200MB）不会卡死
- [ ] 网络异常时应用不会无响应
- [ ] 快速切换视频不会重复生成字幕
- [ ] 跟读模式运行1分钟后自动关闭

### 3. 性能测试
- [ ] 低配置Win10电脑（4GB内存）能流畅运行
- [ ] CPU占用率在合理范围内（<80%）
- [ ] 内存占用稳定，无明显泄漏
- [ ] **任务管理器中只显示1个应用进程**

## 重新打包

修复完成后，需要重新打包应用：

```bash
# 构建生产版本
npm run build

# 生成的安装包位于 release 目录
# video-read-along-windows-1.0.0.exe
```

## 注意事项

1. **单实例保护（重要）**
   - ✅ 应用现在只允许运行一个实例
   - ✅ 多次点击图标只会聚焦到已存在的窗口
   - ✅ 任务管理器中只会显示1个进程
   - ⚠️ 如果应用异常退出，需要等待几秒才能重新启动

2. **首次使用体验优化**
   - 应用启动后立即显示界面
   - 字幕服务在后台启动，可能需要几秒
   - 首次选择视频后，字幕生成需要时间（取决于视频长度）

3. **大文件处理**
   - 超过200MB的视频不会自动生成字幕
   - 用户可以手动关闭/开启字幕功能

4. **错误处理**
   - 所有异步操作都有超时保护
   - 失败时不会阻塞UI，只在控制台输出错误
   - 即使字幕生成失败，视频仍可正常播放

## 后续优化建议

1. **添加进度提示**
   - 显示字幕生成的实时进度
   - 提供取消生成的选项

2. **缓存优化**
   - 已生成的字幕永久缓存
   - 添加缓存管理功能

3. **资源监控**
   - 实时监控CPU和内存占用
   - 超过阈值时自动降级（如停止字幕生成）

4. **用户配置**
   - 允许用户自定义是否自动生成字幕
   - 可调整文件大小限制阈值
