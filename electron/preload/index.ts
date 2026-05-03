import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    on: (channel: string, func: (...args: any[]) => void) => {
      // Validate channel to prevent security issues
      const validChannels = ['file-selected', 'file-dialog-error', 'subtitle-service-log']
      if (!validChannels.includes(channel)) {
        console.warn(`Invalid IPC channel: ${channel}`)
        return () => {} // Return no-op cleanup function
      }
      
      const subscription = (_event: Electron.IpcRendererEvent, ...args: any[]) => func(...args)
      ipcRenderer.on(channel, subscription)
      // Return unsubscribe function
      return () => ipcRenderer.removeListener(channel, subscription)
    },
    removeListener: (channel: string, func: (...args: any[]) => void) => {
      // Validate channel to prevent security issues
      const validChannels = ['file-selected', 'file-dialog-error', 'subtitle-service-log']
      if (!validChannels.includes(channel)) {
        console.warn(`Invalid IPC channel: ${channel}`)
        return
      }
      ipcRenderer.removeListener(channel, func)
    },
    send: (channel: string, ...args: any[]) => {
      // Validate channel to prevent security issues
      const validChannels = ['open-file-dialog']
      if (!validChannels.includes(channel)) {
        console.warn(`Invalid IPC channel: ${channel}`)
        return
      }
      ipcRenderer.send(channel, ...args)
    },
    invoke: async (channel: string, ...args: any[]) => {
      // Validate channel to prevent security issues
      const validChannels = ['get-file-info']
      if (!validChannels.includes(channel)) {
        console.warn(`Invalid IPC invoke channel: ${channel}`)
        return null
      }
      return await ipcRenderer.invoke(channel, ...args)
    }
  }
})

contextBridge.exposeInMainWorld('api', {
  openFile: () => ipcRenderer.send('open-file-dialog')
})
