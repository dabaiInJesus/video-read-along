// 跟读模式服务
export interface RepeatSegment {
  startTime: number
  endTime: number
  text?: string
}

export class ReadAlongMode {
  private videoElement: HTMLVideoElement | null = null
  private isRepeatMode: boolean = false
  private currentSegment: RepeatSegment | null = null
  private repeatCount: number = 0
  private maxRepeat: number = 3
  private onSegmentEnd: (() => void) | null = null
  private timeUpdateHandler: (() => void) | null = null
  private onModeChange: ((isEnabled: boolean) => void) | null = null
  private lastResetTime: number = 0 // 记录上次重置时间，防止快速重复触发
  private resetCooldown: number = 1000 // 冷却时间（毫秒），增加到1秒避免过快触发
  private modeStartTime: number = 0 // 模式启动时间，用于检测异常
  private maxModeDuration: number = 60000 // 最大模式持续时间（1分钟），防止无限循环
  private isProcessing: boolean = false // 防止并发处理

  // 设置视频元素
  setVideoElement(video: HTMLVideoElement) {
    this.videoElement = video
  }

  // 设置模式变化回调
  setOnModeChange(callback: (isEnabled: boolean) => void) {
    this.onModeChange = callback
  }

  // 开启跟读模式
  enableRepeatMode(segment: RepeatSegment, maxRepeat: number = 3) {
    if (!this.videoElement) return false

    this.isRepeatMode = true
    this.currentSegment = segment
    this.maxRepeat = maxRepeat
    this.repeatCount = 0
    this.lastResetTime = 0 // 重置冷却时间
    this.modeStartTime = Date.now() // 记录启动时间

    // 跳转到片段开始
    this.videoElement.currentTime = segment.startTime
    
    // 添加时间更新监听器
    this.timeUpdateHandler = () => this.handleTimeUpdate()
    this.videoElement.addEventListener('timeupdate', this.timeUpdateHandler)

    console.log('跟读模式已开启:', segment)
    
    // 通知状态变化
    if (this.onModeChange) {
      this.onModeChange(true)
    }
    
    return true
  }

  // 关闭跟读模式
  disableRepeatMode() {
    const wasEnabled = this.isRepeatMode
    this.isRepeatMode = false
    this.currentSegment = null
    this.repeatCount = 0

    if (this.videoElement && this.timeUpdateHandler) {
      this.videoElement.removeEventListener('timeupdate', this.timeUpdateHandler)
      this.timeUpdateHandler = null
    }

    console.log('跟读模式已关闭')
    
    // 通知状态变化
    if (wasEnabled && this.onModeChange) {
      this.onModeChange(false)
    }
  }

  // 处理时间更新
  private handleTimeUpdate() {
    if (!this.isRepeatMode || !this.currentSegment || !this.videoElement) return

    // 防止并发处理
    if (this.isProcessing) return
    
    const currentTime = this.videoElement.currentTime
    const now = Date.now()

    // 检查是否超过最大运行时间，防止无限循环
    if (now - this.modeStartTime > this.maxModeDuration) {
      console.warn('跟读模式运行时间过长，自动关闭')
      this.disableRepeatMode()
      return
    }

    // 检查是否到达片段结束
    if (currentTime >= this.currentSegment.endTime) {
      // 防止过快重复触发（冷却机制）
      if (now - this.lastResetTime < this.resetCooldown) {
        return
      }
      
      this.isProcessing = true
      this.repeatCount++
      this.lastResetTime = now

      if (this.repeatCount < this.maxRepeat) {
        // 重复播放
        try {
          const video = this.videoElement
          if (!video) {
            this.isProcessing = false
            return
          }
          
          video.currentTime = this.currentSegment.startTime
          // 确保视频处于暂停状态再重新播放，避免冲突
          video.pause()
          setTimeout(() => {
            if (this.isRepeatMode && this.currentSegment && video) { // 再次检查状态
              video.play().catch(err => {
                console.error('跟读模式播放失败:', err)
                // 如果播放失败，退出跟读模式
                this.disableRepeatMode()
              })
            }
            this.isProcessing = false
          }, 100) // 增加延迟到100ms确保时间跳转完成
          console.log(`重复播放 (${this.repeatCount}/${this.maxRepeat})`)
        } catch (error) {
          console.error('跟读模式时间跳转失败:', error)
          this.isProcessing = false
          this.disableRepeatMode()
        }
      } else {
        // 达到最大重复次数，停止
        this.isProcessing = false
        this.disableRepeatMode()
        if (this.onSegmentEnd) {
          this.onSegmentEnd()
        }
      }
    } else {
      // 不在片段结束时，重置处理标志
      this.isProcessing = false
    }
  }

  // 手动跳到下一句
  nextSegment() {
    this.disableRepeatMode()
  }

  // 设置重复次数
  setMaxRepeat(count: number) {
    this.maxRepeat = count
  }

  // 获取当前状态
  getStatus() {
    return {
      isRepeatMode: this.isRepeatMode,
      currentSegment: this.currentSegment,
      repeatCount: this.repeatCount,
      maxRepeat: this.maxRepeat
    }
  }

  // 销毁
  destroy() {
    this.disableRepeatMode()
    this.onSegmentEnd = null
  }
}
