import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    electron([
      {
        entry: 'electron/main.ts',
        onstart(options) {
          // Notify the Renderer-Process to reload the page when the Main-Process is ready
          options.reload()
        },
        vite: {
          build: { outDir: 'dist-electron', rollupOptions: { external: ['electron'] } }
        }
      },
      {
        entry: 'electron/preload/index.ts',
        vite: {
          build: { outDir: 'dist-electron', rollupOptions: { external: ['electron'] } }
        }
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') }
  },
  base: './',
  server: {
    port: 5180,
    strictPort: true  // Fail if port is already in use
  }
})
