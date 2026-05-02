import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { existsSync } from 'fs'
import { execSync } from 'child_process'
import subtitleService from './subtitleService'

// Fix console encoding for Windows
if (process.platform === 'win32') {
  try {
    // Set Windows console code page to UTF-8 (65001)
    execSync('chcp 65001', { stdio: 'ignore' })
    
    // Set environment variables for UTF-8 encoding
    process.env['NODE_NO_WARNINGS'] = '1'
    process.env['LC_ALL'] = 'C.UTF-8'
    process.env['LANG'] = 'C.UTF-8'
    process.env['LANGUAGE'] = 'C.UTF-8'
    
    // Set stdout to UTF-8
    process.stdout.setDefaultEncoding('utf-8')
    process.stderr.setDefaultEncoding('utf-8')
    
    console.log('[Encoding] Windows console encoding set to UTF-8 (Code Page 65001)')
  } catch (e) {
    console.error('[Encoding] Failed to set encoding:', e)
  }
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false  // Allow loading local files
    }
  })

  // Use 'ready-to-show' event instead of deprecated onDidFinishLoading
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' }
  })

  if (is.dev) {
    // In development, load from Vite dev server
    const url = process.env['VITE_URL'] || process.env['ELECTRON_RENDERER_URL'] || 'http://localhost:5180'
    console.log('Loading URL:', url)
    mainWindow.loadURL(url)
  } else {
    // In production, load the built HTML file
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.video-read-along')

  // Debug: log environment variables
  console.log('ELECTRON_RENDERER_URL:', process.env['ELECTRON_RENDERER_URL'])
  console.log('is.dev:', is.dev)

  // 启动字幕服务（开发模式和生产模式都启动）
  console.log('[Main] Starting subtitle service...')
  await subtitleService.start()

  app.on('browser-window-created', () => {
    // optimizer.observeWindow(window) - commented out due to compatibility issues
  })

  ipcMain.on('open-file-dialog', async (event) => {
    try {
      const { dialog } = await import('electron')
      const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openFile'],
        filters: [{ name: 'Videos & Subtitles', extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'srt', 'vtt'] }]
      })
      
      if (!result.canceled && result.filePaths.length > 0) {
        let filePath = result.filePaths[0]
        
        const fileExists = existsSync(filePath)
        console.log('=== File Dialog Result ===')
        console.log('File exists:', fileExists ? 'YES' : 'NO')
        
        if (!fileExists) {
          console.error('ERROR: File does not exist at path')
          event.sender.send('file-dialog-error', 'File does not exist or path is incorrect')
          return
        }
        
        // 解决 Git Bash 控制台乱码：将中文文件名重命名为时间戳
        try {
          if (filePath.match(/[\u4e00-\u9fa5]/) || filePath.includes('鍓') || filePath.includes('氓') || filePath.includes('炉')) {
            const ext = filePath.split('.').pop()
            const timestamp = Date.now()
            const safePath = `${filePath.substring(0, filePath.lastIndexOf('\\') + 1)}${timestamp}.${ext}`
            
            const fs = await import('fs')
            fs.copyFileSync(filePath, safePath)
            filePath = safePath
          }
        } catch (e) {
          console.error('Path handling error:', e)
        }
        
        // 仅输出处理后的干净路径，避免控制台显示原始乱码
        console.log('File path (cleaned):', filePath)
        console.log('SUCCESS: Sending file-selected event to renderer')
        console.log('=========================\n')
        event.sender.send('file-selected', filePath)
      } else {
        console.log('Dialog canceled or no files selected')
      }
    } catch (error) {
      console.error('Error in open-file-dialog:', error)
      event.sender.send('file-dialog-error', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // 停止字幕服务
  subtitleService.stop()
  
  if (process.platform !== 'darwin') app.quit()
})
