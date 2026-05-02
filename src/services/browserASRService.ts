// 使用 Transformers.js 在浏览器端进行语音识别
import { pipeline } from '@xenova/transformers'

export class BrowserASRService {
  private recognizer: any = null
  private isProcessing: boolean = false

  // 初始化语音识别模型
  async initialize() {
    try {
      console.log('正在加载语音识别模型...')
      this.recognizer = await pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-tiny.zh' // 中文优化的小型模型
      )
      console.log('✅ 模型加载成功')
      return true
    } catch (error) {
      console.error('❌ 模型加载失败:', error)
      return false
    }
  }

  // 从视频文件中提取音频并生成字幕
  async generateSubtitles(videoFile: File, onProgress?: (progress: number) => void) {
    if (!this.recognizer) {
      throw new Error('模型未初始化，请先调用 initialize()')
    }

    this.isProcessing = true
    
    try {
      // 读取文件为 ArrayBuffer
      const arrayBuffer = await videoFile.arrayBuffer()
      
      // 转换为 AudioBuffer
      const audioContext = new AudioContext()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      
      // 降采样到 16kHz
      const sampleRate = 16000
      const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.duration * sampleRate,
        sampleRate
      )
      
      const source = offlineContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(offlineContext.destination)
      source.start()
      
      const resampledBuffer = await offlineContext.startRendering()
      
      // 转换为 Float32Array
      const audioData = resampledBuffer.getChannelData(0)
      
      // 分段处理（每 30 秒一段）
      const segmentDuration = 30 // 秒
      const sampleCount = audioData.length
      const segmentSamples = segmentDuration * sampleRate
      const segments = []
      
      for (let i = 0; i < sampleCount; i += segmentSamples) {
        const segment = audioData.slice(i, Math.min(i + segmentSamples, sampleCount))
        segments.push({
          data: segment,
          startTime: i / sampleRate
        })
      }
      
      // 逐段识别
      const subtitles = []
      for (let i = 0; i < segments.length; i++) {
        if (onProgress) {
          onProgress(Math.round((i / segments.length) * 100))
        }
        
        const segment = segments[i]
        const result = await this.recognizer(segment.data)
        
        if (result.text && result.text.trim()) {
          subtitles.push({
            startTime: segment.startTime,
            endTime: segment.startTime + segmentDuration,
            text: result.text.trim()
          })
        }
      }
      
      if (onProgress) {
        onProgress(100)
      }
      
      this.isProcessing = false
      return subtitles
      
    } catch (error) {
      this.isProcessing = false
      console.error('字幕生成失败:', error)
      throw error
    }
  }

  // 将字幕转换为 SRT 格式
  static convertToSRT(subtitles: Array<{startTime: number, endTime: number, text: string}>): string {
    let srt = ''
    
    subtitles.forEach((subtitle, index) => {
      const startTime = this.formatTime(subtitle.startTime)
      const endTime = this.formatTime(subtitle.endTime)
      
      srt += `${index + 1}\n`
      srt += `${startTime} --> ${endTime}\n`
      srt += `${subtitle.text}\n\n`
    })
    
    return srt
  }

  // 格式化时间为 SRT 格式 (HH:MM:SS,mmm)
  private static formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`
  }

  // 获取处理状态
  getStatus() {
    return {
      isProcessing: this.isProcessing,
      isInitialized: !!this.recognizer
    }
  }
}
