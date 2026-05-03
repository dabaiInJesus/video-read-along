import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { app, BrowserWindow } from 'electron'
import { existsSync, readdirSync, rmSync, statSync } from 'fs'
import { execSync } from 'child_process'

class SubtitleServiceManager {
  private serverProcess: ChildProcess | null = null
  private isRunning: boolean = false
  private port: number = 3001
  private mainWindow: BrowserWindow | null = null
  private tempDir: string = ''

  // 设置主窗口引用
  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window
  }

  constructor() {
    // Fix console encoding for Windows
    if (process.platform === 'win32') {
      try {
        execSync('chcp 65001', { stdio: 'ignore' })
      } catch (e) {
        // Ignore errors
      }
    }
    console.log('[SubtitleService] Manager initialized')
  }

  /**
   * 启动字幕生成服务
   */
  async start(): Promise<boolean> {
    console.log('[SubtitleService] ===== START INITIALIZATION =====')
    
    if (this.isRunning) {
      console.log('[SubtitleService] Already running')
      return true
    }

    try {
      console.log('[SubtitleService] Initialization started...')
      
      // 获取资源路径
      const resourcePath = app.isPackaged 
        ? process.resourcesPath 
        : join(__dirname, '..')
      
      console.log('[SubtitleService] Resource path:', resourcePath)
      console.log('[SubtitleService] Is packaged:', app.isPackaged)
      
      // 检查依赖文件
      const whisperExe = join(resourcePath, 'whisper.cpp', 'whisper-cli.exe')
      const ffmpegExe = join(resourcePath, 'ffmpeg', 'bin', 'ffmpeg.exe')
      const serverScript = join(resourcePath, 'server', 'english-subtitle-server.mjs')
      const serverNodeModules = join(resourcePath, 'server', 'node_modules')
      
      console.log('[SubtitleService] Checking files...')
      console.log('  Server script:', serverScript)
      console.log('  Server exists:', existsSync(serverScript))
      console.log('  Node modules:', serverNodeModules)
      console.log('  Node modules exists:', existsSync(serverNodeModules))
      console.log('  Whisper:', whisperExe)
      console.log('  Whisper exists:', existsSync(whisperExe))
      console.log('  FFmpeg:', ffmpegExe)
      console.log('  FFmpeg exists:', existsSync(ffmpegExe))
      
      // 如果缺少必要文件，使用演示模式
      if (!existsSync(serverScript) || !existsSync(serverNodeModules)) {
        console.warn('[SubtitleService] Required files missing, using demo mode')
        return this.startDemoMode()
      }
      
      // 记录临时目录路径，用于退出时清理
      this.tempDir = join(resourcePath, 'server', 'uploads')
      
      // 尝试启动服务
      console.log('[SubtitleService] Attempting to start server...')
      const success = await this.startServer(resourcePath, whisperExe, ffmpegExe, serverScript)
      
      if (success) {
        console.log('[SubtitleService] ===== SERVER STARTED SUCCESSFULLY =====')
        return true
      } else {
        console.warn('[SubtitleService] Server failed to start, using demo mode')
        return this.startDemoMode()
      }

    } catch (error) {
      console.error('[SubtitleService] Start failed:', error)
      console.error('[SubtitleService] Error details:', error instanceof Error ? error.stack : String(error))
      console.warn('[SubtitleService] Using demo mode due to error')
      return this.startDemoMode()
    }
  }
  
  /**
   * 实际启动服务器的逻辑
   */
  private async startServer(resourcePath: string, whisperExe: string, ffmpegExe: string, serverScript: string): Promise<boolean> {
    try {
      // 检查是否存在任意英文模型（按优先级检查）
      const modelDir = join(resourcePath, 'whisper.cpp', 'models')
      const possibleModels = [
        'ggml-large-v3-turbo.bin',
        'ggml-large-v3.bin',
        'ggml-large-v2.bin',
        'ggml-medium.en.bin',
        'ggml-small.en.bin',
        'ggml-base.en.bin'
      ]
      
      let modelPath = null
      for (const modelName of possibleModels) {
        const testPath = join(modelDir, modelName)
        if (existsSync(testPath)) {
          modelPath = testPath
          break
        }
      }

      console.log('[SubtitleService] Checking dependencies...')
      console.log('  Whisper:', existsSync(whisperExe) ? 'OK' : 'MISSING')
      console.log('  Model:', modelPath ? 'OK' : 'MISSING')
      console.log('  FFmpeg:', existsSync(ffmpegExe) ? 'OK' : 'MISSING')
      console.log('  Server:', existsSync(serverScript) ? 'OK' : 'MISSING')

      // 如果缺少必要文件，返回false
      if (!existsSync(whisperExe) || !modelPath) {
        console.warn('[SubtitleService] Running in demo mode (no whisper.cpp)')
        return false
      }

      // 设置环境变量
      const env = {
        ...process.env,
        WHISPER_PATH: whisperExe,
        MODEL_PATH: modelPath,
        FFMPEG_PATH: ffmpegExe,
        PORT: this.port.toString(),
        LC_ALL: 'C.UTF-8',
        LANG: 'C.UTF-8',
        LANGUAGE: 'C.UTF-8',
        NODE_PATH: join(resourcePath, 'server', 'node_modules')
      }

      console.log('[SubtitleService] Starting server process...')
      
      // 使用 'node' 命令而不是 process.execPath，避免触发 Electron 入口
      const nodePath = 'node'
      
      console.log('[SubtitleService] Using node path:', nodePath)
      
      this.serverProcess = spawn(nodePath, ['--experimental-specifier-resolution=node', serverScript], {
        cwd: join(resourcePath, 'server'),
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      })

      // 监听输出
      this.serverProcess.stdout?.on('data', (data) => {
        const msg = data.toString().trim()
        console.log('[SubtitleService]', msg)
        // 发送日志到渲染进程
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('subtitle-service-log', msg)
        }
      })

      this.serverProcess.stderr?.on('data', (data) => {
        const msg = data.toString().trim()
        console.error('[SubtitleService Error]', msg)
        // 发送错误到渲染进程
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('subtitle-service-error', msg)
        }
      })

      this.serverProcess.on('exit', (code) => {
        console.log(`[SubtitleService] Exited with code ${code}`)
        this.isRunning = false
        this.serverProcess = null
      })

      this.serverProcess.on('error', (error) => {
        console.error('[SubtitleService] Failed to start:', error)
        console.error('[SubtitleService] Error name:', error.name)
        console.error('[SubtitleService] Error message:', error.message)
        console.error('[SubtitleService] Error stack:', error.stack)
        this.isRunning = false
      })

      // 等待服务启动
      await this.waitForServer()
      
      this.isRunning = true
      console.log('[SubtitleService] OK Server started successfully')
      return true

    } catch (error) {
      console.error('[SubtitleService] Server start failed:', error)
      return false
    }
  }

  /**
   * 演示模式（返回示例数据）
   */
  private startDemoMode(): Promise<boolean> {
    return new Promise((resolve) => {
      console.log('[SubtitleService] Starting demo mode...')
      this.isRunning = true
      resolve(true)
    })
  }

  /**
   * 等待服务器就绪
   */
  private async waitForServer(timeout: number = 15000): Promise<void> {
    const startTime = Date.now()
    let checkCount = 0
    const maxChecks = timeout / 1000 // 每秒检查一次
    
    while (Date.now() - startTime < timeout && checkCount < maxChecks) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000) // 每次请求3秒超时
        
        const response = await fetch(`http://localhost:${this.port}/health`, {
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (response.ok) {
          console.log('[SubtitleService] Server is ready')
          return
        }
      } catch (e) {
        // 服务器还未就绪，继续等待
      }
      
      checkCount++
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    throw new Error('Server startup timeout after ' + timeout + 'ms')
  }

  /**
   * 停止服务
   */
  stop(): void {
    if (this.serverProcess) {
      console.log('[SubtitleService] Stopping server...')
      this.serverProcess.kill()
      this.serverProcess = null
      this.isRunning = false
    }
    
    // 清理临时文件
    this.cleanupTempFiles()
  }

  /**
   * 清理临时视频和音频文件
   */
  private cleanupTempFiles(): void {
    if (!this.tempDir || !existsSync(this.tempDir)) {
      return
    }

    console.log('[SubtitleService] Cleaning up temporary files...')
    
    try {
      const files = readdirSync(this.tempDir)
      let cleanedCount = 0
      let cleanedSize = 0
      
      files.forEach(file => {
        const filePath = join(this.tempDir, file)
        try {
          const stats = statSync(filePath)
          // 只删除视频和音频临时文件，保留其他文件
          if (stats.isFile() && (file.endsWith('.mp4') || file.endsWith('.wav') || file.endsWith('.mkv') || file.endsWith('.avi') || file.endsWith('.mov'))) {
            rmSync(filePath)
            cleanedCount++
            cleanedSize += stats.size
          }
        } catch (e) {
          console.error('[SubtitleService] Failed to delete file:', file, e)
        }
      })
      
      if (cleanedCount > 0) {
        console.log(`[SubtitleService] Cleaned ${cleanedCount} temporary files, freed ${(cleanedSize / 1024 / 1024).toFixed(2)} MB`)
      } else {
        console.log('[SubtitleService] No temporary files to clean')
      }
    } catch (error) {
      console.error('[SubtitleService] Failed to clean temp files:', error)
    }
  }

  /**
   * 获取服务状态
   */
  getStatus(): { running: boolean; port: number } {
    return {
      running: this.isRunning,
      port: this.port
    }
  }

  /**
   * 获取 API 基础 URL
   */
  getApiUrl(): string {
    return `http://localhost:${this.port}`
  }
}

export default new SubtitleServiceManager()
