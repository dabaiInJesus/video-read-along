@echo off
chcp 65001 >nul
echo ========================================
echo   启动英语字幕生成服务
echo ========================================
echo.

REM 检查 whisper.cpp
if not exist ..\whisper.cpp\build\Release\main.exe (
    echo [错误] whisper.cpp 未编译
    echo 请先运行: install-whisper-windows.bat
    pause
    exit /b 1
)

REM 检查模型
if not exist ..\whisper.cpp\models\ggml-base.en.bin (
    echo [错误] 英文模型未下载
    echo 请手动下载模型到: ..\whisper.cpp\models\ggml-base.en.bin
    echo 下载地址: https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
    pause
    exit /b 1
)

REM 检查 FFmpeg
where ffmpeg >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] FFmpeg 未安装
    echo 请运行: choco install ffmpeg
    pause
    exit /b 1
)

echo [✓] 所有依赖就绪
echo.
echo 正在启动服务...
echo.

cd ..\server
node english-subtitle-server.js

pause
