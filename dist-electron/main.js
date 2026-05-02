"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const child_process = require("child_process");
const is = {
  dev: !electron.app.isPackaged
};
const platform = {
  isWindows: process.platform === "win32",
  isMacOS: process.platform === "darwin",
  isLinux: process.platform === "linux"
};
const electronApp = {
  setAppUserModelId(id) {
    if (platform.isWindows)
      electron.app.setAppUserModelId(is.dev ? process.execPath : id);
  },
  setAutoLaunch(auto) {
    if (platform.isLinux)
      return false;
    const isOpenAtLogin = () => {
      return electron.app.getLoginItemSettings().openAtLogin;
    };
    if (isOpenAtLogin() !== auto) {
      electron.app.setLoginItemSettings({
        openAtLogin: auto,
        path: process.execPath
      });
      return isOpenAtLogin() === auto;
    } else {
      return true;
    }
  },
  skipProxy() {
    return electron.session.defaultSession.setProxy({ mode: "direct" });
  }
};
class SubtitleServiceManager {
  constructor() {
    this.serverProcess = null;
    this.isRunning = false;
    this.port = 3001;
    if (process.platform === "win32") {
      try {
        child_process.execSync("chcp 65001", { stdio: "ignore" });
      } catch (e) {
      }
    }
    console.log("[SubtitleService] Manager initialized");
  }
  /**
   * 启动字幕生成服务
   */
  async start() {
    var _a, _b;
    if (this.isRunning) {
      console.log("[SubtitleService] Already running");
      return true;
    }
    try {
      const resourcePath = electron.app.isPackaged ? process.resourcesPath : path.join(__dirname, "..");
      const whisperExe = path.join(resourcePath, "whisper.cpp", "whisper-cli.exe");
      const ffmpegExe = path.join(resourcePath, "ffmpeg", "bin", "ffmpeg.exe");
      const serverScript = path.join(resourcePath, "server", "english-subtitle-server.mjs");
      const modelDir = path.join(resourcePath, "whisper.cpp", "models");
      const possibleModels = [
        "ggml-large-v3-turbo.bin",
        "ggml-large-v3.bin",
        "ggml-large-v2.bin",
        "ggml-medium.en.bin",
        "ggml-small.en.bin",
        "ggml-base.en.bin"
      ];
      let modelPath = null;
      for (const modelName of possibleModels) {
        const testPath = path.join(modelDir, modelName);
        if (fs.existsSync(testPath)) {
          modelPath = testPath;
          break;
        }
      }
      console.log("[SubtitleService] Checking dependencies...");
      console.log("  Whisper:", fs.existsSync(whisperExe) ? "OK" : "MISSING");
      console.log("  Model:", modelPath ? "OK (" + possibleModels.find((m) => modelPath.includes(m)) + ")" : "MISSING");
      console.log("  FFmpeg:", fs.existsSync(ffmpegExe) ? "OK" : "MISSING");
      console.log("  Server:", fs.existsSync(serverScript) ? "OK" : "MISSING");
      if (!fs.existsSync(whisperExe) || !modelPath) {
        console.warn("[SubtitleService] Running in demo mode (no whisper.cpp)");
        return this.startDemoMode();
      }
      const env = {
        ...process.env,
        WHISPER_PATH: whisperExe,
        MODEL_PATH: modelPath,
        FFMPEG_PATH: ffmpegExe,
        PORT: this.port.toString(),
        LC_ALL: "C.UTF-8",
        LANG: "C.UTF-8",
        LANGUAGE: "C.UTF-8"
      };
      console.log("[SubtitleService] Starting server...");
      this.serverProcess = child_process.spawn("node", [serverScript], {
        cwd: resourcePath,
        env,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true
      });
      (_a = this.serverProcess.stdout) == null ? void 0 : _a.on("data", (data) => {
        console.log("[SubtitleService]", data.toString().trim());
      });
      (_b = this.serverProcess.stderr) == null ? void 0 : _b.on("data", (data) => {
        console.error("[SubtitleService Error]", data.toString().trim());
      });
      this.serverProcess.on("exit", (code) => {
        console.log(`[SubtitleService] Exited with code ${code}`);
        this.isRunning = false;
        this.serverProcess = null;
      });
      this.serverProcess.on("error", (error) => {
        console.error("[SubtitleService] Failed to start:", error);
        this.isRunning = false;
      });
      await this.waitForServer();
      this.isRunning = true;
      console.log("[SubtitleService] OK Server started successfully");
      return true;
    } catch (error) {
      console.error("[SubtitleService] Start failed:", error);
      return false;
    }
  }
  /**
   * 演示模式（返回示例数据）
   */
  startDemoMode() {
    return new Promise((resolve) => {
      console.log("[SubtitleService] Starting demo mode...");
      this.isRunning = true;
      resolve(true);
    });
  }
  /**
   * 等待服务器就绪
   */
  async waitForServer(timeout = 1e4) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(`http://localhost:${this.port}/health`);
        if (response.ok) {
          return;
        }
      } catch (e) {
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error("Server startup timeout");
  }
  /**
   * 停止服务
   */
  stop() {
    if (this.serverProcess) {
      console.log("[SubtitleService] Stopping server...");
      this.serverProcess.kill();
      this.serverProcess = null;
      this.isRunning = false;
    }
  }
  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      running: this.isRunning,
      port: this.port
    };
  }
  /**
   * 获取 API 基础 URL
   */
  getApiUrl() {
    return `http://localhost:${this.port}`;
  }
}
const subtitleService = new SubtitleServiceManager();
if (process.platform === "win32") {
  try {
    child_process.execSync("chcp 65001", { stdio: "ignore" });
    process.env["NODE_NO_WARNINGS"] = "1";
    process.env["LC_ALL"] = "C.UTF-8";
    process.env["LANG"] = "C.UTF-8";
    process.env["LANGUAGE"] = "C.UTF-8";
    process.stdout.setDefaultEncoding("utf-8");
    process.stderr.setDefaultEncoding("utf-8");
    console.log("[Encoding] Windows console encoding set to UTF-8 (Code Page 65001)");
  } catch (e) {
    console.error("[Encoding] Failed to set encoding:", e);
  }
}
let mainWindow = null;
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
      // Allow loading local files
    }
  });
  mainWindow.once("ready-to-show", () => {
    mainWindow == null ? void 0 : mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: "deny" };
  });
  if (is.dev) {
    const url = process.env["VITE_URL"] || process.env["ELECTRON_RENDERER_URL"] || "http://localhost:5180";
    console.log("Loading URL:", url);
    mainWindow.loadURL(url);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}
electron.app.whenReady().then(async () => {
  electronApp.setAppUserModelId("com.video-read-along");
  console.log("ELECTRON_RENDERER_URL:", process.env["ELECTRON_RENDERER_URL"]);
  console.log("is.dev:", is.dev);
  console.log("[Main] Starting subtitle service...");
  await subtitleService.start();
  electron.app.on("browser-window-created", () => {
  });
  electron.ipcMain.on("open-file-dialog", async (event) => {
    try {
      const { dialog } = await import("electron");
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openFile"],
        filters: [{ name: "Videos & Subtitles", extensions: ["mp4", "mkv", "avi", "mov", "webm", "srt", "vtt"] }]
      });
      if (!result.canceled && result.filePaths.length > 0) {
        let filePath = result.filePaths[0];
        const fileExists = fs.existsSync(filePath);
        console.log("=== File Dialog Result ===");
        console.log("File exists:", fileExists ? "YES" : "NO");
        if (!fileExists) {
          console.error("ERROR: File does not exist at path");
          event.sender.send("file-dialog-error", "File does not exist or path is incorrect");
          return;
        }
        try {
          if (filePath.match(/[\u4e00-\u9fa5]/) || filePath.includes("鍓") || filePath.includes("氓") || filePath.includes("炉")) {
            const ext = filePath.split(".").pop();
            const timestamp = Date.now();
            const safePath = `${filePath.substring(0, filePath.lastIndexOf("\\") + 1)}${timestamp}.${ext}`;
            const fs2 = await import("fs");
            fs2.copyFileSync(filePath, safePath);
            filePath = safePath;
          }
        } catch (e) {
          console.error("Path handling error:", e);
        }
        console.log("File path (cleaned):", filePath);
        console.log("SUCCESS: Sending file-selected event to renderer");
        console.log("=========================\n");
        event.sender.send("file-selected", filePath);
      } else {
        console.log("Dialog canceled or no files selected");
      }
    } catch (error) {
      console.error("Error in open-file-dialog:", error);
      event.sender.send("file-dialog-error", error instanceof Error ? error.message : "Unknown error");
    }
  });
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  subtitleService.stop();
  if (process.platform !== "darwin") electron.app.quit();
});
