import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { app } from 'electron'
import { existsSync } from 'fs'
import { execSync } from 'child_process'

class SubtitleServiceManager {
  private serverProcess: ChildProcess | null = null
  private isRunning: boolean = false
  private port: number = 3001

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
    if (this.isRunning) {
      console.log('[SubtitleService] Already running')
      return true
    }

    try {
      // 获取资源路径
      const resourcePath = app.isPackaged 
        ? process.resourcesPath 
        : join(__dirname, '..')
      
      // 检查依赖文件
      const whisperExe = join(resourcePath, 'whisper.cpp', 'whisper-cli.exe')
      const ffmpegExe = join(resourcePath, 'ffmpeg', 'bin', 'ffmpeg.exe')
      const serverScript = join(resourcePath, 'server', 'english-subtitle-server.mjs')
      
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
      console.log('  Model:', modelPath ? 'OK (' + possibleModels.find(m => modelPath.includes(m)) + ')' : 'MISSING')
      console.log('  FFmpeg:', existsSync(ffmpegExe) ? 'OK' : 'MISSING')
      console.log('  Server:', existsSync(serverScript) ? 'OK' : 'MISSING')

      // 如果缺少必要文件，使用简化模式
      if (!existsSync(whisperExe) || !modelPath) {
        console.warn('[SubtitleService] Running in demo mode (no whisper.cpp)')
        return this.startDemoMode()
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
        LANGUAGE: 'C.UTF-8'
      }

      // 启动 Node.js 服务
      console.log('[SubtitleService] Starting server...')
      this.serverProcess = spawn('node', [serverScript], {
        cwd: resourcePath,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      })

      // 监听输出
      this.serverProcess.stdout?.on('data', (data) => {
        console.log('[SubtitleService]', data.toString().trim())
      })

      this.serverProcess.stderr?.on('data', (data) => {
        console.error('[SubtitleService Error]', data.toString().trim())
      })

      this.serverProcess.on('exit', (code) => {
        console.log(`[SubtitleService] Exited with code ${code}`)
        this.isRunning = false
        this.serverProcess = null
      })

      this.serverProcess.on('error', (error) => {
        console.error('[SubtitleService] Failed to start:', error)
        this.isRunning = false
      })

      // 等待服务启动
      await this.waitForServer()
      
      this.isRunning = true
      console.log('[SubtitleService] OK Server started successfully')
      return true

    } catch (error) {
      console.error('[SubtitleService] Start failed:', error)
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
  private async waitForServer(timeout: number = 10000): Promise<void> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(`http://localhost:${this.port}/health`)
        if (response.ok) {
          return
        }
      } catch (e) {
        // 服务器还未就绪
      }
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    throw new Error('Server startup timeout')
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
