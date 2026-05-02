// AI 字幕生成服务 - 使用 Web Speech API
export interface SubtitleEntry {
  startTime: number
  endTime: number
  text: string
}

export class AISubtitleService {
  private recognition: any = null
  private isListening: boolean = false
  private subtitles: SubtitleEntry[] = []
  private currentSubtitle: Partial<SubtitleEntry> | null = null
  private onSubtitleUpdate: ((subtitles: SubtitleEntry[]) => void) | null = null

  constructor() {
    // 检查浏览器是否支持 SpeechRecognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition()
      this.recognition.continuous = true
      this.recognition.interimResults = true
      this.recognition.lang = 'zh-CN'

      this.recognition.onresult = (event: any) => {
        this.handleRecognitionResult(event)
      }

      this.recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        this.stop()
      }

      this.recognition.onend = () => {
        if (this.isListening) {
          // 如果还在监听状态但识别结束了，重新启动
          try {
            this.recognition.start()
          } catch (e) {
            console.error('Failed to restart recognition:', e)
          }
        }
      }
    }
  }

  // 开始生成 AI 字幕
  async start(_videoElement: HTMLVideoElement, onUpdate: (subtitles: SubtitleEntry[]) => void) {
    if (!this.recognition) {
      alert('您的浏览器不支持语音识别功能\n\n建议使用 Chrome 或 Edge 浏览器')
      return false
    }

    this.onSubtitleUpdate = onUpdate
    this.subtitles = []
    this.currentSubtitle = null

    try {
      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // 停止立即获取的音频流（Web Speech API 会自动处理音频输入）
      stream.getTracks().forEach(track => track.stop())

      // 启动语音识别
      this.isListening = true
      this.recognition.start()
      
      console.log('AI 字幕生成已启动')
      return true
    } catch (error: any) {
      console.error('Failed to start AI subtitle service:', error)
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        alert('需要麦克风权限才能使用 AI 字幕功能\n\n请在浏览器设置中允许麦克风访问')
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        alert('未检测到麦克风设备')
      } else {
        alert('启动 AI 字幕失败：' + error.message)
      }
      
      return false
    }
  }

  // 停止生成 AI 字幕
  stop() {
    this.isListening = false
    if (this.recognition) {
      try {
        this.recognition.stop()
      } catch (e) {
        console.error('Failed to stop recognition:', e)
      }
    }

    if (this.currentSubtitle && this.currentSubtitle.text) {
      this.finalizeCurrentSubtitle()
    }

    console.log('AI 字幕生成已停止')
  }

  // 处理识别结果
  private handleRecognitionResult(event: any) {
    const results = event.results
    const lastResult = results[results.length - 1]
    
    if (!lastResult) return

    const transcript = lastResult[0].transcript
    const isFinal = lastResult.isFinal

    const currentTime = performance.now() / 1000 // 转换为秒

    if (isFinal) {
      // 最终结果，保存字幕
      if (this.currentSubtitle) {
        this.currentSubtitle.endTime = currentTime
        this.currentSubtitle.text = transcript
        this.subtitles.push(this.currentSubtitle as SubtitleEntry)
        this.currentSubtitle = null
      }
    } else {
      // 临时结果，更新当前字幕
      if (!this.currentSubtitle) {
        this.currentSubtitle = {
          startTime: currentTime,
          text: transcript
        }
      } else {
        this.currentSubtitle.text = transcript
      }
    }

    // 通知更新
    if (this.onSubtitleUpdate) {
      this.onSubtitleUpdate([...this.subtitles])
    }
  }

  // 完成当前字幕
  private finalizeCurrentSubtitle() {
    if (this.currentSubtitle && this.currentSubtitle.text) {
      const currentTime = performance.now() / 1000
      this.currentSubtitle.endTime = currentTime
      this.subtitles.push(this.currentSubtitle as SubtitleEntry)
      this.currentSubtitle = null

      if (this.onSubtitleUpdate) {
        this.onSubtitleUpdate([...this.subtitles])
      }
    }
  }

  // 获取当前字幕
  getCurrentSubtitles(): SubtitleEntry[] {
    return [...this.subtitles]
  }

  // 导出字幕为 SRT 格式
  exportToSRT(): string {
    let srt = ''
    this.subtitles.forEach((subtitle, index) => {
      const startTime = this.formatSRTTime(subtitle.startTime)
      const endTime = this.formatSRTTime(subtitle.endTime)
      srt += `${index + 1}\n${startTime} --> ${endTime}\n${subtitle.text}\n\n`
    })
    return srt
  }

  // 格式化 SRT 时间
  private formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`
  }

  // 销毁服务
  destroy() {
    this.stop()
    this.onSubtitleUpdate = null
  }
}
