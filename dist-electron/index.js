"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electron", {
  ipcRenderer: {
    on: (channel, func) => {
      const subscription = (_event, ...args) => func(...args);
      electron.ipcRenderer.on(channel, subscription);
      return () => electron.ipcRenderer.removeListener(channel, subscription);
    },
    removeListener: (channel, func) => {
      electron.ipcRenderer.removeListener(channel, func);
    },
    send: (channel, ...args) => {
      electron.ipcRenderer.send(channel, ...args);
    }
  }
});
electron.contextBridge.exposeInMainWorld("api", {
  openFile: () => electron.ipcRenderer.send("open-file-dialog")
});
