export {}

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        on: (channel: string, func: (...args: any[]) => void) => void
        removeListener: (channel: string, func: (...args: any[]) => void) => void
      }
    }
    api: {
      openFile: () => void
    }
  }
}
