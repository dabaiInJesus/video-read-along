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

    const currentTime = this.videoElement.currentTime

    // 检查是否到达片段结束
    if (currentTime >= this.currentSegment.endTime) {
      this.repeatCount++

      if (this.repeatCount < this.maxRepeat) {
        // 重复播放
        this.videoElement.currentTime = this.currentSegment.startTime
        this.videoElement.play()
        console.log(`重复播放 (${this.repeatCount}/${this.maxRepeat})`)
      } else {
        // 达到最大重复次数，停止
        this.disableRepeatMode()
        if (this.onSegmentEnd) {
          this.onSegmentEnd()
        }
      }
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
