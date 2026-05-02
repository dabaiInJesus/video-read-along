# 📦 手动下载 whisper.cpp 和 FFmpeg

## 🎯 快速方案（推荐）

由于自动下载可能遇到网络问题，建议手动下载：

---

## 1️⃣ 下载 whisper.cpp（5 分钟）

### 步骤：

1. **访问 GitHub Releases**
   ```
   https://github.com/ggerganov/whisper.cpp/releases
   ```

2. **下载预编译版本**
   - 找到最新版本（如 v1.x.x）
   - 下载 `whisper-bin-x64.zip`（约 50MB）

3. **解压到项目目录**
   - 解压到：`D:\code\video-read-along\`
   - 会自动创建 `whisper-bin-x64` 文件夹

4. **重命名文件夹**
   ```
   whisper-bin-x64  →  whisper.cpp
   ```

5. **验证**
   ```bash
   ls whisper.cpp/main.exe
   # 应该能看到文件
   ```

---

## 2️⃣ 下载模型文件（3 分钟）

### 步骤：

1. **访问下载链接**
   ```
   https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
   ```

2. **下载文件**
   - 文件大小：约 150MB
   - 可能需要一些时间

3. **放到正确位置**
   ```
   1. 在 whisper.cpp 目录下创建 models 文件夹
   2. 将下载的文件放进去
   3. 确保文件名为：ggml-base.en.bin
   ```

   最终路径：
   ```
   D:\code\video-read-along\whisper.cpp\models\ggml-base.en.bin
   ```

---

## 3️⃣ 下载 FFmpeg（5 分钟）

### 步骤：

1. **访问下载页面**
   ```
   https://www.gyan.dev/ffmpeg/builds/
   ```

2. **下载压缩包**
   - 找到 "Release Builds" 部分
   - 下载 `ffmpeg-git-essentials.7z`（约 90MB）

3. **解压到项目目录**
   - 解压到：`D:\code\video-read-along\`
   - 会创建类似 `ffmpeg-2024-xxx-win64-gpl` 的文件夹

4. **重命名文件夹**
   ```
   ffmpeg-2024-xxx-win64-gpl  →  ffmpeg
   ```

5. **验证**
   ```bash
   ls ffmpeg/bin/ffmpeg.exe
   # 应该能看到文件
   ```

---

## ✅ 最终目录结构

完成后，您的项目目录应该像这样：

```
D:\code\video-read-along\
├── whisper.cpp/
│   ├── main.exe              ← whisper 主程序
│   ├── *.dll                 ← 依赖库
│   └── models/
│       └── ggml-base.en.bin  ← 英文模型（150MB）
├── ffmpeg/
│   └── bin/
│       ├── ffmpeg.exe        ← FFmpeg 主程序
│       └── *.dll             ← 依赖库
├── src/
├── electron/
└── package.json
```

---

## 🚀 下载完成后

所有依赖准备好后，需要更新 package.json 配置。

查看：`PACKAGING_WITH_DEPENDENCIES.md`

---

## 💡 提示

1. **如果下载慢**：可以使用迅雷下载或找国内镜像
2. **whisper.cpp 版本**：使用最新的稳定版即可
3. **模型文件**：base.en 是最平衡的选择（速度+准确率）

---

## ❓ 常见问题

**Q: 下载链接打不开？**

A: 可能需要科学上网，或者使用国内镜像站点。

**Q: 文件放错位置了？**

A: 确保路径完全正确，特别是模型文件的位置。

**Q: 如何验证下载成功？**

A: 运行以下命令：
```bash
whisper.cpp/main.exe --help
ffmpeg/bin/ffmpeg.exe -version
```

---

祝您顺利！🎉
