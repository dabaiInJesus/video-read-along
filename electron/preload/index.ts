import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    on: (channel: string, func: (...args: any[]) => void) => {
      const subscription = (_event: Electron.IpcRendererEvent, ...args: any[]) => func(...args)
      ipcRenderer.on(channel, subscription)
      // Return unsubscribe function
      return () => ipcRenderer.removeListener(channel, subscription)
    },
    removeListener: (channel: string, func: (...args: any[]) => void) => {
      ipcRenderer.removeListener(channel, func)
    },
    send: (channel: string, ...args: any[]) => {
      ipcRenderer.send(channel, ...args)
    }
  }
})

contextBridge.exposeInMainWorld('api', {
  openFile: () => ipcRenderer.send('open-file-dialog')
})
