import fs from 'fs'
import path from 'path'
import { defineConfig, Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import execa from 'execa'

const commit = execa.sync('git', ['rev-parse', 'HEAD']).stdout.slice(0, 7)

export default defineConfig({
  plugins: [vue(), copyVuePlugin()],
  define: {
    __COMMIT__: JSON.stringify(commit),
    __VUE_PROD_DEVTOOLS__: JSON.stringify(true)
  },
  optimizeDeps: {
    exclude: ['@vue/repl']
  }
})

function copyVuePlugin(): Plugin {
  return {
    name: 'copy-vue',
    generateBundle() {
      const copyFile = (file: string) => {
        const filePath = path.resolve(__dirname, file)
        const basename = path.basename(file)
        if (!fs.existsSync(filePath)) {
          throw new Error(
            `${basename} not built. ` +
              `Run "nr build vue -f esm-browser" first.`
          )
        }
        this.emitFile({
          type: 'asset',
          fileName: basename,
          source: fs.readFileSync(filePath, 'utf-8')
        })
      }

      copyFile(`../vue/dist/vue.runtime.esm-browser.js`)
      copyFile(`../server-renderer/dist/server-renderer.esm-browser.js`)
    }
  }
}
