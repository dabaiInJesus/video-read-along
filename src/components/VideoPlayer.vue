<script setup lang="ts">
import { ref, watch, onUnmounted, onMounted } from 'vue'
import { ReadAlongMode, type RepeatSegment } from '../services/readAlongMode'

const props = defineProps<{
  videoSrc: string
  subtitleSrc: string
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const playbackRate = ref(1.0)
const subtitleEnabled = ref(true) // 默认开启字幕
const currentTime = ref(0)
const duration = ref(0)
const isPlaying = ref(false)
const isFullscreen = ref(false) // 全屏状态
const canPlay = ref(false) // 是否可以播放（字幕提取完成后才允许）

// 右键菜单
const showContextMenu = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })

// 跟读模式相关
const readAlongMode = new ReadAlongMode()
const isReadAlongMode = ref(false)
const repeatCount = ref(3)

// 设置跟读模式变化回调
readAlongMode.setOnModeChange((isEnabled) => {
  isReadAlongMode.value = isEnabled
  console.log('跟读模式状态变化:', isEnabled ? '开启' : '关闭')
})

const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]

// 全屏功能
function toggleFullscreen() {
  const container = document.querySelector('.video-container') as HTMLElement
  if (!container) return
  
  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    container.requestFullscreen().catch(err => {
      console.error('Error attempting to enable fullscreen:', err)
    })
  }
}

// 监听全屏状态变化
function handleFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
  console.log('全屏状态:', isFullscreen.value ? '进入' : '退出')
}

// 阻止视频区域右键菜单
function handleContextMenu(event: Event) {
  event.preventDefault()
  
  // 显示自定义右键菜单
  const mouseEvent = event as MouseEvent
  contextMenuPosition.value = {
    x: mouseEvent.clientX,
    y: mouseEvent.clientY
  }
  showContextMenu.value = true
  
  return false
}

// 关闭右键菜单
function closeContextMenu() {
  showContextMenu.value = false
}

// 点击其他地方关闭右键菜单
function handleClickOutside(_event: Event) {
  if (showContextMenu.value) {
    closeContextMenu()
  }
}

function setSpeed(speed: number) {
  playbackRate.value = speed
  if (videoRef.value) {
    videoRef.value.playbackRate = speed
  }
}

function togglePlay() {
  if (!videoRef.value || !canPlay.value) return
  if (isPlaying.value) {
    videoRef.value.pause()
  } else {
    videoRef.value.play()
  }
}

// 切换字幕（仅控制显示/隐藏，不触发重新生成）
function toggleSubtitle() {
  if (!videoRef.value) return
  
  // 状态循环：AI字幕 -> 关闭 -> AI字幕
  if (subtitleEnabled.value) {
    // 从开启切换到关闭
    subtitleEnabled.value = false
    currentSubtitleText.value = ''
    console.log('关闭字幕')
  } else {
    // 从关闭切换到开启（如果已有字幕数据，直接显示）
    if (parsedSubtitles.value.length > 0) {
      subtitleEnabled.value = true
      console.log('重新开启字幕')
    } else {
      console.log('字幕尚未生成，无法开启')
    }
  }
}

// 自动生成 AI 字幕（上传视频后自动调用）
async function generateAiSubtitles() {
  // 如果已有字幕数据，不重复生成
  if (parsedSubtitles.value.length > 0) {
    console.log('字幕已存在，跳过生成')
    return
  }
  
  // 如果没有视频源，不生成
  if (!props.videoSrc) {
    console.log('没有视频源，跳过生成')
    return
  }
  
  try {
    console.log('=== 开始自动生成 AI 字幕 ===')
    
    // 检查后端服务是否可用
    const healthCheck = await fetch('http://localhost:3001/health').catch(() => null)
    
    if (!healthCheck || !healthCheck.ok) {
      console.warn('AI 字幕服务未启动，跳过自动生成')
      return
    }
    
    // 显示内联进度条
    const progressContainer = document.getElementById('ai-subtitle-progress')
    const progressBar = document.getElementById('progress-bar-inline')
    const progressText = document.getElementById('progress-text-inline')
    
    if (progressContainer) {
      progressContainer.classList.remove('hidden')
    }
    
    // 模拟进度条动画
    let progress = 0
    const progressInterval = setInterval(() => {
      progress += Math.random() * 15
      if (progress > 95) progress = 95
      
      if (progressBar) {
        progressBar.style.width = progress + '%'
      }
      
      if (progressText) {
        if (progress < 30) {
          progressText.textContent = '正在提取音频...'
        } else if (progress < 60) {
          progressText.textContent = '正在识别语音...'
        } else if (progress < 90) {
          progressText.textContent = '正在生成字幕...'
        } else {
          progressText.textContent = '即将完成...'
        }
      }
    }, 500)
    
    try {
      // 将视频文件转换为 Blob 并上传
      const videoUrl = props.videoSrc
      const response = await fetch(videoUrl)
      const videoBlob = await response.blob()
      
      // 创建 FormData
      const formData = new FormData()
      const fileName = videoUrl.split('/').pop() || 'video.mp4'
      formData.append('video', videoBlob, fileName)
      
      // 调用后端 API
      const apiResponse = await fetch('http://localhost:3001/api/generate-english-subtitles', {
        method: 'POST',
        body: formData
      })
      
      const result = await apiResponse.json()
      
      // 停止进度条动画
      clearInterval(progressInterval)
      
      // 隐藏进度条
      if (progressContainer) {
        progressContainer.classList.add('hidden')
      }
      
      if (result.success && result.subtitles) {
        console.log('=== AI 字幕生成成功 ===')
        console.log('返回数据:', result)
        console.log('字幕内容预览:', result.subtitles.substring(0, 200))
        console.log('字幕总长度:', result.subtitles.length)
        console.log('统计信息:', result.stats)
        
        // 保存字幕内容并解析
        aiSubtitleContent.value = result.subtitles
        parsedSubtitles.value = parseSRT(result.subtitles)
        console.log('解析后的字幕数量:', parsedSubtitles.value.length)
        console.log('前5条字幕数据结构:', JSON.stringify(parsedSubtitles.value.slice(0, 5), null, 2))
        
        // 默认开启字幕显示
        subtitleEnabled.value = true
        canPlay.value = true // 字幕生成完成后允许播放
        console.log('AI 字幕已启用，共', parsedSubtitles.value.length, '条')
      } else {
        console.error('字幕生成返回错误:', result)
        throw new Error(result.message || '字幕生成失败')
      }
    } catch (error) {
      // 停止进度条动画
      clearInterval(progressInterval)
      
      // 隐藏进度条
      if (progressContainer) {
        progressContainer.classList.add('hidden')
      }
      
      throw error
    }
    
  } catch (error) {
    console.error('AI 字幕生成失败:', error)
    // 不弹窗，只在控制台显示错误
  }
}

// 自定义字幕显示
const aiSubtitleContent = ref('') // AI 字幕原始内容
const currentSubtitleText = ref('') // 当前显示的字幕文本
const parsedSubtitles = ref<Array<{start: number, end: number, text: string}>>([]) // 解析后的字幕数据

// 字幕样式设置
const subtitleFontSize = ref(24) // 默认字体大小 24px
const subtitleColor = ref('#ffffff') // 默认白色
const showSubtitleSettings = ref(false) // 是否显示设置面板

// 重置字幕设置为默认值
function resetSubtitleSettings() {
  subtitleFontSize.value = 24
  subtitleColor.value = '#ffffff'
}

// 解析 SRT 字幕格式
function parseSRT(srtContent: string): Array<{start: number, end: number, text: string}> {
  console.log('=== Parsing SRT Content ===')
  console.log('Raw content length:', srtContent.length)
  console.log('First 500 chars:', srtContent.substring(0, 500))
  
  const subtitles: Array<{start: number, end: number, text: string}> = []
  
  // 支持多种换行符格式（\r\n\r\n 或 \n\n）
  const blocks = srtContent.trim().split(/\r?\n\r?\n/)
  
  console.log('Split into', blocks.length, 'blocks')
  
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim()
    if (!block) continue
    
    const parts = block.split(/\r?\n/)
    console.log(`Block ${i}:`, parts.length, 'parts', parts.slice(0, 3))
    
    if (parts.length >= 3) {
      // 解析时间行（格式：00:00:01,000 --> 00:00:04,000）
      const timeLine = parts[1]
      const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/)
      
      if (timeMatch) {
        const startSeconds = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000
        const endSeconds = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000
        const text = parts.slice(2).join('\n').trim()
        
        subtitles.push({
          start: startSeconds,
          end: endSeconds,
          text: text
        })
        
        if (subtitles.length <= 3) {
          console.log(`  Parsed subtitle ${subtitles.length}:`, { start: startSeconds, end: endSeconds, text: text.substring(0, 50) })
        }
      } else {
        console.log('  Failed to match time pattern:', parts[1])
      }
    } else {
      console.log('  Block has less than 3 parts:', parts.length)
    }
  }
  
  console.log('Total parsed subtitles:', subtitles.length)
  if (subtitles.length > 0) {
    console.log('First subtitle:', subtitles[0])
    console.log('Last subtitle:', subtitles[subtitles.length - 1])
  }
  console.log('==========================\n')
  
  return subtitles
}

// 根据当前时间更新字幕显示
function updateCurrentAiSubtitle() {
  if (!subtitleEnabled.value || parsedSubtitles.value.length === 0) {
    currentSubtitleText.value = ''
    return
  }
  
  const current = currentTime.value
  // 查找当前时间对应的字幕（使用 < 而不是 <= 避免边界问题）
  const subtitle = parsedSubtitles.value.find(sub => current >= sub.start && current < sub.end)
  
  if (subtitle) {
    currentSubtitleText.value = subtitle.text
    console.log('[Subtitle]', Math.floor(current * 10) / 10 + 's:', subtitle.text.substring(0, 50))
  } else {
    currentSubtitleText.value = ''
    // 每10秒输出一次未找到字幕的信息，避免日志过多
    if (Math.floor(current) % 10 === 0 && Math.floor(current * 10) % 10 === 0) {
      console.log('[Subtitle] No subtitle found for time:', current, 'Total subtitles:', parsedSubtitles.value.length)
    }
  }
}

// 视频时间更新处理
function onTimeUpdate(event: Event) {
  const video = event.target as HTMLVideoElement
  currentTime.value = video.currentTime
  updateCurrentAiSubtitle()
  
  // 调试信息：每5秒输出一次字幕状态
  if (Math.floor(currentTime.value) % 5 === 0 && Math.floor(currentTime.value * 10) % 10 === 0) {
    console.log('[TimeUpdate]', {
      currentTime: currentTime.value,
      subtitleEnabled: subtitleEnabled.value,
      parsedSubtitlesLength: parsedSubtitles.value.length,
      currentSubtitleText: currentSubtitleText.value.substring(0, 30)
    })
  }
}

// 视频元数据加载完成处理
function onLoadedMetadata(event: Event) {
  const video = event.target as HTMLVideoElement
  duration.value = video.duration
  console.log('[Video] Metadata loaded, duration:', duration.value)
  console.log('[Video] Parsed subtitles count:', parsedSubtitles.value.length)
  if (parsedSubtitles.value.length > 0) {
    console.log('[Video] First subtitle:', parsedSubtitles.value[0])
  }
}

// 开启跟读模式（重复播放当前5秒）
function toggleReadAlongMode() {
  if (!videoRef.value) return

  if (isReadAlongMode.value) {
    // 关闭跟读模式
    console.log('手动关闭跟读模式')
    readAlongMode.disableRepeatMode()
    isReadAlongMode.value = false
  } else {
    // 开启跟读模式 - 重复播放当前时间前后2.5秒的片段
    const segmentStart = Math.max(0, currentTime.value - 2.5)
    const segmentEnd = Math.min(duration.value, currentTime.value + 2.5)
    
    const segment: RepeatSegment = {
      startTime: segmentStart,
      endTime: segmentEnd
    }
    
    readAlongMode.setVideoElement(videoRef.value)
    const success = readAlongMode.enableRepeatMode(segment, repeatCount.value)
    
    if (success) {
      isReadAlongMode.value = true
      videoRef.value.play()
      console.log('跟读模式已开启，片段:', segment)
    }
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function seek(target: number) {
  if (!videoRef.value) return
  videoRef.value.currentTime = target
}

// 处理视频错误
function handleVideoError(event: Event) {
  const video = event.target as HTMLVideoElement
  const error = video.error
  
  console.error('=== Video Playback Error ===')
  console.error('Video element:', video)
  console.error('Video src:', video.src)
  console.error('Video currentSrc:', video.currentSrc)
  console.error('Error object:', error)
  
  let errorMessage = '视频播放失败'
  
  if (error) {
    switch (error.code) {
      case MediaError.MEDIA_ERR_ABORTED:
        errorMessage = '视频加载被中止'
        break
      case MediaError.MEDIA_ERR_NETWORK:
        errorMessage = '网络错误，请检查文件路径'
        break
      case MediaError.MEDIA_ERR_DECODE:
        errorMessage = '视频解码错误，文件格式可能不支持'
        break
      case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
        errorMessage = '不支持的视频格式或文件路径错误'
        break
      default:
        errorMessage = `未知错误 (代码: ${error.code})`
    }
  }
  
  console.error('Error details:', {
    message: errorMessage,
    src: props.videoSrc,
    error: error,
    networkState: video.networkState,
    readyState: video.readyState
  })
  console.error('=================================\n')
  
  alert(`❌ ${errorMessage}\n\n请检查：\n1. 视频文件是否存在\n2. 文件格式是否支持\n3. 文件路径是否包含特殊字符`)
}

watch(() => props.videoSrc, async (newVal, oldVal) => {
  console.log('=== VideoPlayer: videoSrc Changed ===')
  console.log('Old value:', oldVal)
  console.log('New value:', newVal)
  console.log('New value type:', typeof newVal)
  console.log('New value length:', newVal?.length || 0)
  console.log('Is truthy:', !!newVal)
  console.log('Starts with file://:', newVal?.startsWith('file://'))
  console.log('Contains backslash:', newVal?.includes('\\'))
  console.log('=====================================\n')
  
  currentTime.value = 0
  duration.value = 0
  isPlaying.value = false
  // 切换视频时关闭跟读模式
  if (isReadAlongMode.value) {
    readAlongMode.disableRepeatMode()
    isReadAlongMode.value = false
  }
  
  // 重置字幕状态
  aiSubtitleContent.value = ''
  currentSubtitleText.value = ''
  parsedSubtitles.value = []
  subtitleEnabled.value = true // 默认开启字幕
  canPlay.value = false // 上传新视频后，需要等待字幕生成
  
  // 上传新视频后，自动生成 AI 字幕
  if (newVal) {
    console.log('检测到新视频，开始自动生成 AI 字幕...')
    await generateAiSubtitles() // 等待生成完成
  } else {
    console.log('视频源为空，不生成字幕')
  }
})

onUnmounted(() => {
  if (videoRef.value) {
    videoRef.value.pause()
  }
  // 清理跟读模式
  readAlongMode.destroy()
  // 移除全屏监听
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  // 移除全局点击监听
  document.removeEventListener('click', handleClickOutside)
})

onMounted(() => {
  // 监听全屏状态变化
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  // 监听全局点击事件，关闭右键菜单
  document.addEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Video Area -->
    <div class="video-container bg-slate-800 rounded-xl shadow-lg flex-1 flex flex-col min-h-0">
      <div class="relative bg-black flex-1 flex items-center justify-center min-h-0" @contextmenu="handleContextMenu">
        <video
          v-if="videoSrc"
          ref="videoRef"
          :src="videoSrc"
          class="max-w-full max-h-full object-contain outline-none"
          @contextmenu="handleContextMenu"
          @timeupdate="onTimeUpdate"
          @loadedmetadata="onLoadedMetadata"
          @play="isPlaying = true"
          @pause="isPlaying = false"
          @ended="isPlaying = false"
          @error="handleVideoError"
        >
        </video>

        <!-- 全屏时的浮动控制栏 -->
        <div 
          v-if="isFullscreen"
          class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 hidden"
        >
          <div class="flex items-center justify-between gap-3">
            <!-- 左侧：播放控制 -->
            <div class="flex items-center gap-2">
              <button
                @click="togglePlay"
                class="w-10 h-10 rounded-full flex items-center justify-center transition-colors text-lg bg-blue-600 hover:bg-blue-500 text-white"
              >
                {{ isPlaying ? '⏸' : '▶' }}
              </button>
              
              <!-- 进度条 -->
              <div class="flex items-center gap-2">
                <span class="text-white text-xs">{{ formatTime(currentTime) }}</span>
                <input
                  type="range"
                  min="0"
                  :max="duration || 100"
                  :value="currentTime"
                  @input="seek(Number(($event.target as HTMLInputElement).value))"
                  class="w-64 h-1 bg-white/30 rounded appearance-none cursor-pointer accent-blue-500"
                />
                <span class="text-white text-xs">{{ formatTime(duration) }}</span>
              </div>
            </div>

            <!-- 右侧：功能按钮 -->
            <div class="flex items-center gap-2">
              <button
                @click="showSubtitleSettings = !showSubtitleSettings"
                class="px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors text-xs bg-white/20 text-white hover:bg-white/30"
              >
                🎨 字幕设置
              </button>

              <button
                @click="toggleSubtitle"
                class="px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors text-xs bg-white/20 text-white hover:bg-white/30"
              >
                🤖 {{ subtitleEnabled ? 'AI字幕' : '关闭' }}
              </button>

              <button
                @click="toggleReadAlongMode"
                class="px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors text-xs"
                :class="isReadAlongMode ? 'bg-green-600 text-white' : 'bg-white/20 text-white hover:bg-white/30'"
              >
                🎯 {{ isReadAlongMode ? '正常' : '跟读' }}
              </button>

              <button
                @click="toggleFullscreen"
                class="px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors text-xs bg-white/20 text-white hover:bg-white/30"
              >
                ⛶ 退出
              </button>
            </div>
          </div>
        </div>

        <div v-else-if="!videoSrc" class="text-slate-400 flex flex-col items-center gap-4">
          <span class="text-6xl">🎬</span>
          <p>点击上方「选择视频/字幕」上传文件</p>
        </div>

        <!-- 自定义 AI 字幕显示层 -->
        <div 
          v-if="subtitleEnabled && currentSubtitleText"
          class="absolute bottom-16 left-0 right-0 px-8 text-center pointer-events-none z-30"
          style="text-shadow: 2px 2px 4px rgba(0,0,0,0.8);"
        >
          <div class="inline-block bg-black/70 backdrop-blur-sm rounded-lg px-6 py-3 max-w-[80%]">
            <p 
              class="font-medium leading-relaxed whitespace-pre-line"
              :style="{
                fontSize: subtitleFontSize + 'px',
                color: subtitleColor
              }"
            >
              {{ currentSubtitleText }}
            </p>
          </div>
        </div>

        <!-- 字幕设置面板 -->
        <div 
          v-if="showSubtitleSettings"
          class="absolute top-4 right-4 bg-slate-800/95 backdrop-blur-sm rounded-lg p-4 shadow-xl z-20 w-64"
        >
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-white text-sm font-medium"> 字幕设置</h4>
            <button 
              @click="showSubtitleSettings = false"
              class="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          
          <!-- 字体大小 -->
          <div class="mb-3">
            <label class="text-slate-300 text-xs mb-1 block">字体大小: {{ subtitleFontSize }}px</label>
            <input 
              type="range" 
              min="12" 
              max="48" 
              v-model.number="subtitleFontSize"
              class="w-full h-1 bg-slate-600 rounded appearance-none cursor-pointer accent-blue-500"
            />
          </div>
          
          <!-- 字体颜色 -->
          <div class="mb-3">
            <label class="text-slate-300 text-xs mb-1 block">字体颜色</label>
            <div class="flex gap-2 flex-wrap">
              <button 
                v-for="color in ['#ffffff', '#ffff00', '#00ff00', '#00ffff', '#ff6600', '#ff00ff']"
                :key="color"
                @click="subtitleColor = color"
                class="w-8 h-8 rounded-lg border-2 transition-all"
                :class="subtitleColor === color ? 'border-blue-500 scale-110' : 'border-slate-600'"
                :style="{ backgroundColor: color }"
              />
            </div>
          </div>
          
          <!-- 重置按钮 -->
          <button 
            @click="resetSubtitleSettings"
            class="w-full py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-colors"
          >
            重置默认
          </button>
        </div>

        <!-- 右键菜单 -->
        <div 
          v-if="showContextMenu"
          class="fixed bg-slate-800/95 backdrop-blur-sm rounded-lg shadow-xl z-50 py-2 min-w-[180px]"
          :style="{
            left: contextMenuPosition.x + 'px',
            top: contextMenuPosition.y + 'px'
          }"
          @contextmenu.prevent
        >
          <button 
            @click="togglePlay(); closeContextMenu()"
            class="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 flex items-center gap-2"
          >
            {{ isPlaying ? '⏸' : '▶' }} {{ isPlaying ? '暂停' : '播放' }}
          </button>
          <button 
            @click="toggleSubtitle(); closeContextMenu()"
            class="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 flex items-center gap-2"
          >
            🤖 {{ subtitleEnabled ? '关闭字幕' : '开启字幕' }}
          </button>
          <div class="border-t border-slate-700 my-1"></div>
          <div class="px-4 py-1 text-xs text-slate-400">倍速</div>
          <button 
            v-for="speed in speeds"
            :key="speed"
            @click="setSpeed(speed); closeContextMenu()"
            class="w-full px-4 py-2 text-left text-sm hover:bg-slate-700 flex items-center gap-2"
            :class="playbackRate === speed ? 'text-blue-400' : 'text-white'"
          >
            {{ playbackRate === speed ? '✓' : '  ' }} {{ speed }}x
          </button>
          <div class="border-t border-slate-700 my-1"></div>
          <button 
            @click="toggleFullscreen(); closeContextMenu()"
            class="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 flex items-center gap-2"
          >
            ⛶ {{ isFullscreen ? '退出全屏' : '全屏' }}
          </button>
        </div>
      </div>

      <!-- Controls -->
      <div class="bg-slate-800 px-4 py-3 flex-shrink-0">
        <!-- Progress bar -->
        <div class="mb-2 space-y-1">
          <div class="flex justify-between text-xs text-slate-400">
            <span>{{ formatTime(currentTime) }}</span>
            <span>{{ formatTime(duration) }}</span>
          </div>
          <input
            type="range"
            min="0"
            :max="duration || 100"
            :value="currentTime"
            @input="seek(Number(($event.target as HTMLInputElement).value))"
            class="w-full h-1 bg-slate-600 rounded appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        <!-- Buttons row -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <!-- Left: Play + Speed -->
          <div class="flex items-center gap-2 flex-wrap">
            <!-- Play/Pause -->
            <button
              @click="togglePlay"
              class="w-10 h-10 rounded-full flex items-center justify-center transition-colors text-lg bg-blue-600 hover:bg-blue-500 text-white outline-none"
              :class="{ 'opacity-50 cursor-not-allowed': !canPlay }"
              :disabled="!canPlay"
            >
              <svg v-if="isPlaying" class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1"/>
                <rect x="14" y="4" width="4" height="16" rx="1"/>
              </svg>
              <svg v-else class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>

            <!-- Speed buttons -->
            <div class="flex items-center gap-1 flex-wrap">
              <span class="text-slate-400 text-sm">倍速:</span>
              <button
                v-for="speed in speeds"
                :key="speed"
                @click="setSpeed(speed)"
                class="px-2 py-1 rounded text-xs transition-colors outline-none"
                :class="playbackRate === speed ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'"
              >
                {{ speed }}x
              </button>
            </div>
          </div>

          <!-- Right: 功能按钮 + 使用提示 -->
          <div class="flex items-center gap-2 flex-wrap">
            <button
              @click="showSubtitleSettings = !showSubtitleSettings"
              class="px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors text-xs bg-slate-700 text-slate-300 hover:bg-slate-600 outline-none"
            >
              🎨 字幕设置
            </button>

            <button
              @click="toggleSubtitle"
              class="px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors text-xs outline-none"
              :class="subtitleEnabled ? 'bg-purple-600 text-white hover:bg-purple-500' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'"
            >
              🤖 {{ subtitleEnabled ? 'AI字幕' : '关闭' }}
            </button>

            <button
              @click="toggleReadAlongMode"
              class="px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors text-xs outline-none"
              :class="isReadAlongMode ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'"
            >
              🎯 {{ isReadAlongMode ? '正常' : '跟读' }}
            </button>

            <button
              @click="toggleFullscreen"
              class="px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors text-xs bg-slate-700 text-slate-300 hover:bg-slate-600 outline-none"
            >
              ⛶ 全屏
            </button>

            <!-- 使用提示 - 右下角 -->
            <div class="relative group inline-block">
              <button class="px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors text-xs text-slate-400 hover:text-white">
                <span>💡</span>
                <span>提示</span>
              </button>
              <!-- Tooltip -->
              <div class="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-slate-800 border border-slate-700 rounded-lg p-4 shadow-xl min-w-[300px] z-50">
                <h4 class="text-white font-medium mb-2">💡 使用提示</h4>
                <ul class="space-y-1.5 text-xs text-slate-300">
                  <li>• 支持格式：MP4、MKV、AVI、MOV、WebM</li>
                  <li>• 字幕格式：SRT、VTT（上传视频后上传字幕文件即可）</li>
                  <li>• 🤖 AI字幕：点击切换 AI字幕 / 关闭（需上传字幕文件或部署后端服务）</li>
                  <li>• 🎯 跟读模式：点击「跟读模式」，自动重复播放当前5秒片段</li>
                  <li>• 快捷键：空格键 播放/暂停</li>
                  <li>• 倍速范围：0.5x ~ 2.0x，适合跟读练习</li>
                </ul>
                <div class="absolute top-full right-4 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-slate-800"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- AI 字幕生成进度条（控制栏下方） -->
      <div id="ai-subtitle-progress" class="hidden bg-slate-800 px-0 py-1 border-t border-slate-700">
        <div class="w-full bg-slate-700 h-1">
          <div id="progress-bar-inline" class="bg-blue-500 h-1 transition-all duration-300" style="width: 0%"></div>
        </div>
      </div>
    </div>
  </div>
</template>
