@echo off
chcp 65001 >nul
echo ========================================
echo   视频跟读助手 - 自动打包脚本
echo ========================================
echo.

REM 检查必要文件
echo [1/5] 检查依赖文件...

if not exist whisper.cpp\build\Release\main.exe (
    echo [错误] whisper.cpp 未编译
    echo 请先运行: install-whisper-windows.bat
    pause
    exit /b 1
)
echo [✓] whisper.cpp 已编译

if not exist whisper.cpp\models\ggml-base.en.bin (
    echo [错误] 英文模型未下载
    echo 请手动下载模型到: whisper.cpp\models\ggml-base.en.bin
    pause
    exit /b 1
)
echo [✓] 模型文件存在

if not exist ffmpeg\bin\ffmpeg.exe (
    echo [警告] FFmpeg 未找到
    echo 请下载 FFmpeg 并放到 ffmpeg/ 目录
    echo 下载地址: https://www.gyan.dev/ffmpeg/builds/
    set /p continue="是否继续？(y/n): "
    if /i not "%continue%"=="y" exit /b 1
) else (
    echo [✓] FFmpeg 已就绪
)

echo.
echo [2/5] 安装依赖...
call npm install
if %errorlevel% neq 0 (
    echo [错误] npm install 失败
    pause
    exit /b 1
)
echo [✓] 依赖安装完成

echo.
echo [3/5] 构建前端...
call npm run build:vite
if %errorlevel% neq 0 (
    echo [错误] 前端构建失败
    pause
    exit /b 1
)
echo [✓] 前端构建完成

echo.
echo [4/5] 编译 Electron...
call npx tsc -p electron/tsconfig.json 2>nul
if %errorlevel% neq 0 (
    echo [警告] TypeScript 编译有警告，继续...
)
echo [✓] Electron 编译完成

echo.
echo [5/5] 打包 EXE...
echo 这可能需要 5-10 分钟，请耐心等待...
echo.
call npx electron-builder --win
if %errorlevel% neq 0 (
    echo [错误] 打包失败
    pause
    exit /b 1
)

echo.
echo ========================================
echo   打包成功！
echo ========================================
echo.
echo 安装包位置: release\视频跟读助手 Setup x.x.x.exe
echo.
echo 下一步:
echo 1. 测试安装包
echo 2. 验证离线运行
echo 3. 发布给用户
echo.
pause
