<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import VideoPlayer from './components/VideoPlayer.vue'

const videoSrc = ref('')
const subtitleSrc = ref('')

// Detect platform - in Electron renderer, we can use navigator.userAgent
const isWindows = navigator.userAgent.toLowerCase().includes('win')

// 存储清理函数
let cleanupFunctions: Array<() => void> = []

onMounted(() => {
  console.log('=== App Mounted ===')
  console.log('window.api:', window.api)
  console.log('window.electron:', window.electron)
  console.log('window.electron.ipcRenderer:', window.electron?.ipcRenderer)
  console.log('Platform detected:', isWindows ? 'Windows' : 'Other')
  
  if (!window.api) {
    console.error('❌ window.api is not defined!')
  }
  
  if (!window.electron || !window.electron.ipcRenderer) {
    console.error('❌ window.electron.ipcRenderer is not defined!')
  }
  
  // 监听字幕服务日志
  const subtitleLogCleanup = window.electron.ipcRenderer.on('subtitle-service-log', (message: string) => {
    console.log('[Subtitle Service]', message)
  })
  cleanupFunctions.push(subtitleLogCleanup)
  
  // 监听字幕服务错误
  const subtitleErrorCleanup = window.electron.ipcRenderer.on('subtitle-service-error', (message: string) => {
    console.error('[Subtitle Service Error]', message)
  })
  cleanupFunctions.push(subtitleErrorCleanup)
  
  // Listen for file dialog errors
  console.log('Setting up file-dialog-error listener...')
  const errorCleanup = window.electron.ipcRenderer.on('file-dialog-error', (errorMsg: string) => {
    console.error('File dialog error:', errorMsg)
    // 不使用 alert，避免触发循环弹窗
    // 在控制台显示错误即可
  })
  cleanupFunctions.push(errorCleanup)
  
  // Listen for file-selected event
  console.log('Setting up file-selected listener...')
  const fileSelectedCleanup = window.electron.ipcRenderer.on('file-selected', (filePath: string) => {
    console.log('=== File Selected Event Received ===')
    console.log('File selected:', filePath)
    console.log('File path type:', typeof filePath)
    console.log('File path length:', filePath.length)
    
    // Verify we got a valid path
    if (!filePath || filePath.trim() === '') {
      console.error('Received empty file path')
      // 不使用 alert，直接返回
      return
    }
    
    // Convert Windows path to proper file URL
    let normalizedPath = filePath
    if (isWindows) {
      // Replace backslashes with forward slashes for URLs
      normalizedPath = filePath.replace(/\\/g, '/')
      console.log('Normalized Windows path:', normalizedPath)
    }
    
    const ext = normalizedPath.split('.').pop()?.toLowerCase()
    console.log('File extension:', ext)
    
    // Use encodeURI to handle special characters and Chinese characters
    const encodedPath = encodeURI(normalizedPath)
    console.log('Encoded path:', encodedPath)
    
    if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext || '')) {
      // For Windows, try using the path directly first (Electron with webSecurity disabled)
      // If that doesn't work, fall back to file:// protocol
      
      // Option 1: Try direct path (works in Electron with webSecurity: false)
      const directPath = normalizedPath
      console.log('🎬 Trying direct path:', directPath)
      
      videoSrc.value = directPath
      console.log('✅ Video source set to:', videoSrc.value)
      
      // Also log the raw path for debugging
      console.log('📝 Normalized path:', normalizedPath)
      console.log('📝 Encoded path:', encodedPath)
    } else if (['srt', 'vtt'].includes(ext || '')) {
      subtitleSrc.value = isWindows
        ? `file:///${encodedPath}`
        : `file://${encodedPath}`
      console.log('✅ Subtitle source set:', subtitleSrc.value)
    } else {
      console.log('Unsupported file type:', ext)
      // 不使用 alert，只在控制台显示
      console.error(`不支持的文件类型: ${ext}\n支持的视频格式: MP4, MKV, AVI, MOV, WebM\n支持的字幕格式: SRT, VTT`)
    }
    console.log('========================================\n')
  })
  cleanupFunctions.push(fileSelectedCleanup)
  
  console.log('✅ All IPC listeners set up successfully')
  console.log('===========================\n')
})

onUnmounted(() => {
  // 清理所有 IPC 监听器
  console.log('Cleaning up IPC listeners...')
  cleanupFunctions.forEach(cleanup => cleanup())
  cleanupFunctions = []
  console.log('✅ IPC listeners cleaned up')
})

function openFile() {
  window.api.openFile()
}
</script>

<template>
  <div class="h-screen bg-slate-900 flex flex-col overflow-hidden">
    <!-- Header -->
    <header class="bg-slate-800 border-b border-slate-700 px-6 py-3 flex items-center justify-between flex-shrink-0">
      <h1 class="text-xl font-semibold text-white">📺 视频跟读</h1>
      <button
        @click="openFile"
        class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
      >
        📂 选择视频/字幕
      </button>
    </header>

    <!-- Main Content -->
    <main class="flex-1 p-4 overflow-hidden">
      <VideoPlayer :video-src="videoSrc" :subtitle-src="subtitleSrc" />
    </main>

    <!-- Footer -->
    <footer class="bg-slate-800 border-t border-slate-700 px-6 py-2 text-center text-slate-400 text-xs flex-shrink-0">
      上传视频 → 自动提取AI字幕 → 选择倍速 → 跟读练习
    </footer>
  </div>
</template>
