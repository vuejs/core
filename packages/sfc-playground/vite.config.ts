import fs from 'node:fs'
import path from 'node:path'
import { type Plugin, defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { execaSync } from 'execa'

const commit = execaSync('git', ['rev-parse', '--short=7', 'HEAD']).stdout

export default defineConfig({
  plugins: [
    vue({
      script: {
        fs: {
          fileExists: fs.existsSync,
          readFile: file => fs.readFileSync(file, 'utf-8'),
        },
      },
    }),
    copyVuePlugin(),
  ],
  define: {
    __COMMIT__: JSON.stringify(commit),
    __VUE_PROD_DEVTOOLS__: JSON.stringify(true),
  },
  optimizeDeps: {
    exclude: ['@vue/repl'],
  },
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
              `Run "nr build vue -f esm-browser" first.`,
          )
        }
        this.emitFile({
          type: 'asset',
          fileName: basename,
          source: fs.readFileSync(filePath, 'utf-8'),
        })
      }

      copyFile(`../vue/dist/vue.esm-browser.js`)
      copyFile(`../vue/dist/vue.esm-browser.prod.js`)
      copyFile(`../vue/dist/vue.runtime.esm-browser.js`)
      copyFile(`../vue/dist/vue.runtime.esm-browser.prod.js`)
      copyFile(`../server-renderer/dist/server-renderer.esm-browser.js`)
    },
  }
}
