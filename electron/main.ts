import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { existsSync } from 'fs'
import { execSync } from 'child_process'
import subtitleService from './subtitleService'

// 检查当前进程是否为字幕服务进程
const serverScriptArg = process.argv.find(arg => arg.includes('english-subtitle-server.mjs'))

if (serverScriptArg) {
  // 这是字幕服务进程，直接运行服务器脚本
  console.log('Detected server process, starting server from:', serverScriptArg)
  import(serverScriptArg).catch(err => {
    console.error('Failed to start server:', err)
    process.exit(1)
  })
  // 保持进程运行
  process.stdin.resume()
} else {
  // 这是主应用进程，执行单实例锁检查
  const gotTheLock = app.requestSingleInstanceLock()

  if (!gotTheLock) {
    // 如果已经有一个实例在运行，直接退出
    console.log('Another instance is already running, quitting...')
    app.quit()
  } else {
    // 当尝试启动第二个实例时，聚焦到第一个实例的窗口
    app.on('second-instance', () => {
      console.log('Second instance attempted, focusing existing window...')
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
      }
    })

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
    let isFileDialogOpen = false // 防止重复打开文件选择对话框
    let isWindowCreating = false // 防止重复创建窗口
    let hasStartedSubtitleService = false // 防止重复启动字幕服务
    let windowCreationLock = false // 额外的窗口创建锁

    const createWindow = (): void => {
      // 防止重复创建窗口 - 双重检查
      if (windowCreationLock || isWindowCreating || mainWindow) {
        console.log('Window already exists or is being created, skipping...')
        return
      }
      
      windowCreationLock = true
      isWindowCreating = true
      console.log('Creating main window...')
      
      try {
        mainWindow = new BrowserWindow({
          width: 1200,
          height: 800,
          autoHideMenuBar: true,
          show: false, // 先不显示，等ready-to-show事件再显示
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
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show()
            mainWindow.focus()
            isWindowCreating = false
            windowCreationLock = false
            console.log('Main window created and shown')
          } else {
            // 如果窗口已被销毁，重置状态
            isWindowCreating = false
            windowCreationLock = false
            mainWindow = null
          }
        })
        
        // 如果窗口关闭，重置标志
        mainWindow.on('closed', () => {
          console.log('Main window closed')
          mainWindow = null
          isWindowCreating = false
          windowCreationLock = false
          // 移除所有事件监听器，防止内存泄漏和重复触发
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.removeAllListeners()
          }
        })

        mainWindow.webContents.setWindowOpenHandler(() => {
          return { action: 'deny' }
        })

        if (is.dev) {
          // In development, load from Vite dev server
          const url = process.env['VITE_URL'] || process.env['ELECTRON_RENDERER_URL'] || 'http://localhost:5180'
          console.log('Loading URL:', url)
          mainWindow.loadURL(url).catch(err => {
            console.error('Failed to load URL:', err)
            isWindowCreating = false
            windowCreationLock = false
            mainWindow = null
          })
        } else {
          // In production, load the built HTML file
          mainWindow.loadFile(join(__dirname, '../dist/index.html')).catch(err => {
            console.error('Failed to load file:', err)
            isWindowCreating = false
            windowCreationLock = false
            mainWindow = null
          })
        }
      } catch (error) {
        console.error('Error creating window:', error)
        isWindowCreating = false
        windowCreationLock = false
        mainWindow = null
      }
    }

    app.whenReady().then(async () => {
      console.log('=== App is ready, initializing... ===')
      electronApp.setAppUserModelId('com.video-read-along')

      // Debug: log environment variables
      console.log('ELECTRON_RENDERER_URL:', process.env['ELECTRON_RENDERER_URL'])
      console.log('is.dev:', is.dev)
      console.log('Platform:', process.platform)
      console.log('Process ID:', process.pid)

      // 创建窗口（先创建窗口，让用户看到界面）
      createWindow()

      // 传递窗口引用给字幕服务
      if (mainWindow) {
        subtitleService.setMainWindow(mainWindow)
      }

      // 异步启动字幕服务（不阻塞UI）
      if (!hasStartedSubtitleService) {
        console.log('[Main] Starting subtitle service in background...')
        // 延迟1秒启动，让窗口先显示出来
        setTimeout(async () => {
          try {
            await subtitleService.start()
            hasStartedSubtitleService = true
            console.log('[Main] Subtitle service started successfully')
          } catch (error) {
            console.error('[Main] Failed to start subtitle service:', error)
          }
        }, 1000)
      }

      app.on('browser-window-created', () => {
        // optimizer.observeWindow(window) - commented out due to compatibility issues
      })

      ipcMain.on('open-file-dialog', async (event) => {
        // 防止重复打开文件选择对话框
        if (isFileDialogOpen) {
          console.log('File dialog is already open, ignoring request')
          return
        }
        
        try {
          isFileDialogOpen = true
          const { dialog } = await import('electron')
          const result = await dialog.showOpenDialog(mainWindow!, {
            properties: ['openFile'],
            filters: [{ name: 'Videos & Subtitles', extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'srt', 'vtt'] }]
          })
          
          if (!result.canceled && result.filePaths.length > 0) {
            const filePath = result.filePaths[0]
            
            const fileExists = existsSync(filePath)
            console.log('=== File Dialog Result ===')
            console.log('File exists:', fileExists ? 'YES' : 'NO')
            console.log('Original path:', filePath)
            
            if (!fileExists) {
              console.error('ERROR: File does not exist at path')
              event.sender.send('file-dialog-error', 'File does not exist or path is incorrect')
              isFileDialogOpen = false
              return
            }
            
            // 直接使用原始文件路径，不再复制文件
            // 现代 Electron + FFmpeg 已能正确处理中文路径
            console.log('Using original file path (no copy)')
            console.log('SUCCESS: Sending file-selected event to renderer')
            console.log('=========================\n')
            event.sender.send('file-selected', filePath)
          } else {
            console.log('Dialog canceled or no files selected')
          }
        } catch (error) {
          console.error('Error in open-file-dialog:', error)
          event.sender.send('file-dialog-error', error instanceof Error ? error.message : 'Unknown error')
        } finally {
          // 确保标志位被重置
          setTimeout(() => {
            isFileDialogOpen = false
          }, 500) // 延迟500ms重置，防止过快连续点击
        }
      })

      // 获取文件信息（大小、是否存在）
      ipcMain.handle('get-file-info', async (_event, filePath: string) => {
        try {
          const fs = await import('fs')
          if (existsSync(filePath)) {
            const stats = fs.statSync(filePath)
            return {
              exists: true,
              size: stats.size,
              path: filePath
            }
          } else {
            return {
              exists: false,
              size: 0,
              path: filePath
            }
          }
        } catch (error) {
          console.error('Error getting file info:', error)
          return {
            exists: false,
            size: 0,
            path: filePath,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      })

      // 确保只注册一次activate事件
      let activateRegistered = false
      app.on('activate', () => {
        // 防止重复处理activate事件
        if (activateRegistered) {
          console.log('Activate event already registered, ignoring...')
          return
        }
        
        activateRegistered = true
        console.log('App activated')
        
        // 只有在没有窗口时才创建新窗口
        const allWindows = BrowserWindow.getAllWindows()
        if (allWindows.length === 0) {
          console.log('No windows found, creating new window...')
          createWindow()
        } else if (mainWindow && !mainWindow.isDestroyed()) {
          // 如果窗口存在但被隐藏，则显示它
          console.log('Window exists, restoring/focusing...')
          if (mainWindow.isMinimized()) mainWindow.restore()
          mainWindow.focus()
        } else {
          console.log('mainWindow is destroyed, creating new window...')
          mainWindow = null
          createWindow()
        }
      })
    })

    app.on('window-all-closed', () => {
      // 停止字幕服务
      subtitleService.stop()
      
      if (process.platform !== 'darwin') app.quit()
    })
  }
}