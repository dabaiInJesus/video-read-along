// English Teaching Subtitle Service
// Optimized for English language learning

// Fix console encoding for Windows
import { execSync } from 'child_process'
if (process.platform === 'win32') {
  try {
    // Set Windows console code page to UTF-8 (65001)
    execSync('chcp 65001', { stdio: 'ignore' })
    console.log('[Encoding] Console code page set to 65001 (UTF-8)')
    
    // Force stdout/stderr to use UTF-8
    process.stdout.setEncoding('utf8')
    process.stderr.setEncoding('utf8')
  } catch (e) {
    console.error('[Encoding] Failed to set code page:', e)
  }
}

// 带时间戳的日志函数
function logWithTime(message) {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  // Use write instead of log to ensure UTF-8 encoding
  process.stdout.write(`[${timestamp}] ${message}\n`)
}

// 错误日志函数
function errorWithTime(message) {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  // Use write instead of error to ensure UTF-8 encoding
  process.stderr.write(`[${timestamp}] ${message}\n`)
}

import express from 'express'
import cors from 'cors'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { exec } from 'child_process'
import { promisify } from 'util'
import crypto from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const execAsync = promisify(exec)

const app = express()
const PORT = 3001

// Middleware
app.use(cors())
app.use(express.json({ limit: '100mb' }))

// 创建目录
const UPLOAD_DIR = path.join(__dirname, 'uploads')
const OUTPUT_DIR = path.join(__dirname, 'output')

// 从环境变量或默认路径获取 whisper.cpp 和 FFmpeg 路径
// 优先使用环境变量，否则尝试本地路径
let WHISPER_DIR = process.env.WHISPER_PATH 
  ? path.dirname(process.env.WHISPER_PATH)
  : null

if (!WHISPER_DIR) {
  // 尝试本地 whisper.cpp 路径
  const localWhisper = path.join(__dirname, '..', 'whisper.cpp', 'whisper-cli.exe')
  if (fs.existsSync(localWhisper)) {
    WHISPER_DIR = path.join(__dirname, '..', 'whisper.cpp')
    logWithTime('[Whisper] Using local whisper.cpp: ' + WHISPER_DIR)
  } else {
    logWithTime('[Whisper] whisper.cpp not found locally')
  }
}

// 优先使用环境变量，否则尝试本地路径
let FFMPEG_PATH = process.env.FFMPEG_PATH
if (!FFMPEG_PATH) {
  // 尝试本地 FFmpeg 路径
  const localFfmpeg = path.join(__dirname, '..', 'ffmpeg', 'bin', 'ffmpeg.exe')
  if (fs.existsSync(localFfmpeg)) {
    FFMPEG_PATH = localFfmpeg
    logWithTime('[FFmpeg] Using local FFmpeg: ' + localFfmpeg)
  } else {
    FFMPEG_PATH = 'ffmpeg' // Fallback to system PATH
    logWithTime('[FFmpeg] Using system FFmpeg from PATH')
  }
}

;[UPLOAD_DIR, OUTPUT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
})

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + '-' + file.originalname)
  }
})

const upload = multer({ 
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB
})

// 计算文件 MD5 哈希
function getFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5')
    const stream = fs.createReadStream(filePath)
    stream.on('data', data => hash.update(data))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

// 生成英文字幕接口
app.post('/api/generate-english-subtitles', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' })
    }

    logWithTime('Received video file: ' + req.file.filename)
    
    const videoPath = req.file.path
    // 使用时间戳作为文件名，避免中文和特殊字符问题
    const timestamp = Date.now()
    const audioPath = path.join(UPLOAD_DIR, `${timestamp}.wav`)
    const outputBase = path.join(OUTPUT_DIR, `${timestamp}`)
    
    logWithTime('Video path: ' + videoPath)
    logWithTime('Audio path: ' + audioPath)
    logWithTime('Output base: ' + outputBase)
    
    // 检查是否已有相同文件的字幕缓存
    try {
      const fileHash = await getFileHash(videoPath)
      const cachedSrtPath = path.join(OUTPUT_DIR, `${fileHash}.srt`)
      
      if (fs.existsSync(cachedSrtPath)) {
        logWithTime('Found cached subtitle for this video (hash: ' + fileHash.substring(0, 8) + '...)')
        const cachedContent = fs.readFileSync(cachedSrtPath, 'utf-8')
        
        // 清理上传的临时文件
        fs.unlinkSync(videoPath)
        logWithTime('Cleaned uploaded video file')
        
        return res.json({
          success: true,
          subtitles: cachedContent,
          message: 'Subtitle retrieved from cache',
          stats: {
            duration: 'Calculating...',
            segments: (cachedContent.match(/\d+\n/g) || []).length,
            cached: true
          }
        })
      }
      
      logWithTime('No cache found, generating new subtitle (hash: ' + fileHash.substring(0, 8) + '...)')
      
      // 将 hash 附加到 outputBase 用于缓存
      req.fileHash = fileHash
    } catch (e) {
      logWithTime('Cache check failed: ' + e.message)
    }
    
    // Step 1: Extract audio
    logWithTime('Step 1: Extracting audio...')
    logWithTime('   FFmpeg path: ' + FFMPEG_PATH)
    logWithTime('   Video exists: ' + fs.existsSync(videoPath))
    
    try {
      // 添加超时处理（最多 5 分钟）
      const { stdout, stderr } = await execAsync(
        `"${FFMPEG_PATH}" -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}"`,
        { timeout: 300000 }
      )
      if (stderr) {
        logWithTime('   FFmpeg stderr: ' + stderr.substring(0, 200))
      }
      logWithTime('Audio extraction completed')
      logWithTime('   Audio file exists: ' + fs.existsSync(audioPath))
      logWithTime('   Audio file size: ' + (fs.existsSync(audioPath) ? fs.statSync(audioPath).size : 0) + ' bytes')
    } catch (ffmpegError) {
      errorWithTime('FFmpeg error: ' + ffmpegError.message)
      throw new Error('Audio extraction failed: ' + ffmpegError.message)
    }
    
    // Step 2: Use Whisper for subtitle generation (English optimized)
    logWithTime('Step 2: Using Whisper for English recognition...')
    
    // 支持多种 whisper.exe 路径和名称
    let whisperExe = null
    const possiblePaths = [
      process.env.WHISPER_PATH, // Environment variable specified
      path.join(WHISPER_DIR, 'Release', 'whisper-cli.exe'), // New version name
      path.join(WHISPER_DIR, 'whisper-cli.exe'),
      path.join(WHISPER_DIR, 'Release', 'main.exe'), // Old version name
      path.join(WHISPER_DIR, 'main.exe'),
      path.join(WHISPER_DIR, 'main') // Linux/Mac
    ]
    
    for (const p of possiblePaths) {
      if (p && fs.existsSync(p)) {
        whisperExe = p
        break
      }
    }
    
    if (!whisperExe) {
      throw new Error('whisper.cpp not found, please check path: ' + WHISPER_DIR)
    }
    
    logWithTime('[Whisper] Using executable: ' + whisperExe)
    
    // Select best available English model (larger = better accuracy)
    let modelPath = null
    const modelPriority = [
      path.join(WHISPER_DIR, 'models', 'ggml-large-v3-turbo.bin'),
      path.join(WHISPER_DIR, 'models', 'ggml-large-v3.bin'),
      path.join(WHISPER_DIR, 'models', 'ggml-large-v2.bin'),
      path.join(WHISPER_DIR, 'models', 'ggml-medium.en.bin'),
      path.join(WHISPER_DIR, 'models', 'ggml-small.en.bin'),
      path.join(WHISPER_DIR, 'models', 'ggml-base.en.bin') // Current fallback
    ]
    
    for (const m of modelPriority) {
      if (fs.existsSync(m)) {
        modelPath = m
        break
      }
    }
    
    if (!modelPath) {
      throw new Error('No English model found. Download one using: ./models/download-ggml-model.sh <model-name>')
    }
    
    const modelName = path.basename(modelPath)
    logWithTime(`[Whisper] Using model: ${modelName} (larger model = better accuracy)`)
    
    if (!fs.existsSync(whisperExe)) {
      throw new Error('whisper.cpp not found, please compile first')
    }
    
    // Simplified Whisper command for compatibility
    const whisperCmd = `"${whisperExe}" ` +
      `-m "${modelPath}" ` +
      `-f "${audioPath}" ` +
      `--output-file "${outputBase}" ` +
      `--output-srt ` +
      `-l en ` +
      `--temperature 0.0 ` +
      `--best-of 3 ` +
      `--beam-size 3`
    
    logWithTime('Executing command: ' + whisperCmd)
    
    try {
      const { stdout, stderr } = await execAsync(whisperCmd, { timeout: 600000 })
      if (stderr) {
        logWithTime('Whisper stderr: ' + stderr.substring(0, 500))
      }
    } catch (whisperError) {
      errorWithTime('Whisper execution failed: ' + whisperError.message)
      throw new Error('Whisper recognition failed: ' + whisperError.message)
    }
    
    logWithTime('Subtitle generation completed')
    
    // Check for SRT file
    const srtPath = outputBase + '.srt'
    if (!fs.existsSync(srtPath)) {
      // Check if output file exists with different extension
      const possibleFiles = fs.readdirSync(path.dirname(outputBase))
        .filter(f => f.startsWith(path.basename(outputBase)))
      errorWithTime('SRT file not found. Available files: ' + JSON.stringify(possibleFiles))
      throw new Error('Subtitle file generation failed. Check Whisper output.')
    }
    
    const subtitleContent = fs.readFileSync(srtPath, 'utf-8')
    logWithTime('SRT file read successfully, size: ' + subtitleContent.length + ' bytes')
    logWithTime('Subtitle preview:\n' + subtitleContent.substring(0, 500))
    
    // 保存字幕到缓存（使用文件 MD5 哈希作为文件名）
    if (req.fileHash) {
      const cachePath = path.join(OUTPUT_DIR, `${req.fileHash}.srt`)
      fs.copyFileSync(srtPath, cachePath)
      logWithTime('Subtitle cached with hash: ' + req.fileHash.substring(0, 8) + '...')
    }
    
    // 清理临时文件（保留字幕缓存）
    try {
      const filesToClean = [
        videoPath,           // 上传的视频文件
        audioPath,           // 提取的音频文件
        srtPath,             // 生成的字幕文件（已缓存）
        outputBase + '.txt', // 可能的文本输出
        outputBase + '.vtt', // 可能的VTT输出
        outputBase + '.json' // 可能的JSON输出
      ]
      
      let cleanedCount = 0
      filesToClean.forEach(file => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file)
          cleanedCount++
        }
      })
      
      logWithTime(`Cleaned ${cleanedCount} temporary files (subtitle cached)`)
    } catch (e) {
      errorWithTime('Cleanup warning: ' + e.message)
    }
    
    logWithTime('Processing completed!')
    
    res.json({
      success: true,
      subtitles: subtitleContent,
      message: 'English subtitles generated successfully',
      stats: {
        duration: 'Calculating...',
        segments: (subtitleContent.match(/\d+\n/g) || []).length
      }
    })
    
  } catch (error) {
    errorWithTime('Subtitle generation error: ' + error.message)
    errorWithTime('Error stack: ' + error.stack)
    res.status(500).json({ 
      error: 'Subtitle generation failed',
      message: error.message,
      hint: 'Please ensure FFmpeg and whisper.cpp are installed'
    })
  }
})

// 健康检查
app.get('/health', (req, res) => {
  const whisperDir = path.join(__dirname, '..', 'whisper.cpp')
  const hasWhisper = fs.existsSync(path.join(whisperDir, 'whisper-cli.exe')) || 
                     fs.existsSync(path.join(whisperDir, 'main.exe'))
  
  res.json({ 
    status: 'ok', 
    service: 'english-subtitle-generator',
    whisper_available: hasWhisper,
    timestamp: new Date().toISOString()
  })
})

// 启动服务器
app.listen(PORT, () => {
  const separator = '='.repeat(60)
  process.stdout.write(`\n${separator}\n`)
  process.stdout.write('[STARTUP] English Subtitle Generator Service Started\n')
  process.stdout.write(`[STARTUP] Server URL: http://localhost:${PORT}\n`)
  process.stdout.write('[STARTUP] Optimization: English recognition with Chinese-English mixed support\n')
  process.stdout.write('[STARTUP] Note: Please ensure FFmpeg and whisper.cpp are installed\n')
  process.stdout.write(`${separator}\n\n`)
})
