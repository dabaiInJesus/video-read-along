# 🎬 Video Read Along - 视频跟读软件

一个基于 Electron + Vue 3 的视频跟读学习软件，支持 AI 自动生成英语字幕、跟读模式、倍速播放等功能。

## ✨ 核心功能

-  **AI 字幕生成** - 使用 whisper.cpp 离线生成英语字幕，支持中英混合
- 🎯 **跟读模式** - 自动重复播放当前 5 秒片段，适合口语练习
-  **倍速播放** - 支持 0.5x ~ 2.0x 多档倍速
- 📁 **多格式支持** - 支持 MP4、MKV、AVI、MOV、WebM 等视频格式
- 📝 **字幕支持** - 支持 SRT、VTT 字幕文件，可上传外部字幕
-  **全屏模式** - 沉浸式学习体验
- 🔒 **离线使用** - 所有功能本地运行，无需联网

## 🚀 快速开始

### 一键启动（推荐）

```bash
npm start
```

这会同时启动前端开发服务器和后端 AI 字幕服务。

### 手动启动

```bash
# 终端 1: 启动后端字幕服务
npm run server

# 终端 2: 启动前端开发服务器
npm run dev
```

### 打包发布

```bash
npm run build
```

打包完成后，安装包位于 `release/` 目录，文件名格式：`Video-Read-Along-Setup-1.0.0.exe`

## 📦 技术栈

- **前端框架**: Vue 3 + TypeScript + Vite
- **桌面框架**: Electron
- **样式**: Tailwind CSS
- **AI 字幕**: whisper.cpp (C++)
- **音视频处理**: FFmpeg
- **后端服务**: Node.js + Express

## 🛠️ 开发环境

### 前置要求

- Node.js >= 18.0
- npm >= 9.0
- Git

### 安装依赖

```bash
npm install
cd server && npm install && cd ..
```

### 目录结构

```
video-read-along/
├── electron/          # Electron 主进程
│   ├── main.ts       # 主进程入口
│   ├── preload/      # 预加载脚本
│   └── subtitleService.ts  # 字幕服务管理
├── server/           # 后端字幕服务
│   └── english-subtitle-server.mjs  # Express 服务
├── src/              # Vue 前端源码
│   ├── components/   # Vue 组件
│   │   ── VideoPlayer.vue  # 视频播放器
│   ├── services/     # 业务逻辑
│   │   ├── readAlongMode.ts   # 跟读模式
│   │   └── browserASRService.ts  # 语音识别
│   └── App.vue       # 根组件
├── ffmpeg/           # FFmpeg 二进制文件
├── whisper.cpp/      # whisper.cpp 编译文件
└── release/          # 打包输出目录
```

##  使用指南

### 1. 选择视频

点击「选择视频/字幕」按钮，选择本地视频文件。

### 2. 使用 AI 字幕

1. 确保后端服务已启动（`npm start` 或 `npm run server`）
2. 点击「🤖 AI字幕」按钮
3. 等待字幕生成（进度条显示在控制栏下方）
4. 字幕会自动显示在视频上，与语音同步
5. 再次点击可关闭字幕

### 3. 跟读模式

1. 播放视频到想练习的片段
2. 点击「🎯 跟读」按钮
3. 系统会自动重复播放当前 5 秒片段（前后各 2.5 秒）
4. 再次点击退出跟读模式

### 4. 倍速播放

点击底部倍速按钮（0.5x ~ 2.0x）调整播放速度。

## 🔧 技术细节

### AI 字幕生成流程

```
视频文件 → FFmpeg 提取音频 → whisper.cpp 识别语音 → 生成 SRT 字幕 → 前端显示
```

### 依赖文件路径

项目会自动检测以下依赖：

1. **FFmpeg**: `ffmpeg/bin/ffmpeg.exe` 或系统 PATH
2. **whisper.cpp**: `whisper.cpp/Release/whisper-cli.exe`
3. **模型文件**: `whisper.cpp/models/ggml-base.en.bin`

### 日志格式

后端日志使用 ISO 格式时间戳：

```
[2026-02-01 00:39:46]  收到视频文件: test.mp4
[2026-02-01 00:39:47] 🔊 步骤 1: 提取音频...
[2026-02-01 00:39:48] ✅ 音频提取完成
[2026-02-01 00:39:48]  步骤 2: 使用 Whisper 识别英文...
[2026-02-01 00:39:50] ✅ 字幕生成完成
```

##  注意事项

1. **首次使用**: 需要确保 whisper.cpp 和 FFmpeg 已正确放置在项目目录
2. **字幕生成**: 需要后端服务运行在 `http://localhost:3001`
3. **视频格式**: 建议使用 MP4 格式，兼容性最好
4. **性能**: 长视频字幕生成可能需要较长时间（取决于视频长度和电脑性能）

## 🐛 常见问题

### Q: 字幕生成失败怎么办？

A: 检查以下几点：
1. 后端服务是否运行（`npm run server`）
2. `ffmpeg/bin/ffmpeg.exe` 是否存在
3. `whisper.cpp/Release/whisper-cli.exe` 是否存在
4. `whisper.cpp/models/ggml-base.en.bin` 模型文件是否存在

### Q: 字幕没有显示在视频上？

A: 确保：
1. AI 字幕生成成功（查看控制台日志）
2. 点击「🤖 AI字幕」按钮启用字幕
3. 视频正在播放
4. 检查浏览器控制台是否有错误信息

### Q: 中文乱码问题？

A: 项目已自动设置 Windows 控制台编码为 UTF-8 (Code Page 65001)

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**享受视频跟读学习的乐趣！** 
