# 🚀 快速启动指南

## ⚡ 一键启动（推荐）

### 同时启动前端和后端

```bash
npm start
```

这个命令会：
- ✅ 启动 AI 字幕生成服务（端口 3001）
- ✅ 启动 Vite 开发服务器（端口 5180）
- ✅ 自动打开 Electron 应用窗口

---

## 📋 单独启动

### 只启动前端（Vite + Electron）

```bash
npm run dev
```

### 只启动后端（AI 字幕服务）

```bash
npm run server
```

---

## 🎯 开发流程

### 1. 开发模式

```bash
npm start
```

这会同时运行：
- 前端：Vite 热更新开发服务器
- 后端：Node.js AI 字幕服务

### 2. 构建生产版本

```bash
npm run build
```

生成 Windows 安装包：
```
release/video-read-along-windows-1.0.0.exe
```

---

## 📦 依赖说明

### 前端依赖
- Vue 3
- Vite
- Electron
- Video.js
- TailwindCSS

### 后端依赖
- Express
- Multer（文件上传）
- FFmpeg（音频处理）
- Whisper.cpp（语音识别）

---

## ⚙️ 环境要求

### 必需
- Node.js 18+
- npm 或 yarn

### AI 字幕功能（可选）
- FFmpeg
- Whisper.cpp（已编译）
- 英文模型文件（ggml-base.en.bin）

---

## 🔧 常见问题

### Q: 端口被占用怎么办？

A: 修改配置文件：
- 前端端口：`vite.config.ts`
- 后端端口：`server/english-subtitle-server.mjs`

### Q: 如何停止服务？

A: 在终端按 `Ctrl + C`

### Q: 开发模式下后端服务没有启动？

A: 使用 `npm start` 命令，它会同时启动前后端。

---

## 📝 端口说明

| 服务 | 端口 | 说明 |
|------|------|------|
| Vite 开发服务器 | 5180 | 前端热更新 |
| AI 字幕服务 | 3001 | 后端 API |
| Electron 应用 | - | 桌面窗口 |

---

## 🎉 开始使用

```bash
# 1. 安装依赖（首次运行）
npm install

# 2. 一键启动
npm start

# 3. 打开应用窗口
选择视频文件 → 点击字幕按钮 → 享受 AI 字幕！
```

祝您使用愉快！🚀
