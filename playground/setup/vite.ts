import path from 'node:path'
import { createServer } from 'vite'
import { setupViteNode } from './vite-node'

const dirname = path.dirname(new URL(import.meta.url).pathname)
main()

async function main() {
  const runner = await setupViteNode(async () => {
    const VuePlugin = await getVuePlugin()
    server.config.inlineConfig.plugins = [VuePlugin]
    server.restart()
  })

  const VuePlugin = await getVuePlugin()
  const server = await createServer({
    plugins: [VuePlugin]
  })
  await server.listen()
  server.printUrls()
  server.bindCLIShortcuts({
    print: true
  })

  async function getVuePlugin() {
    const file = path.resolve(dirname, 'vue-plugin.ts')
    const mod = (await runner.executeId(file)) as typeof import('./vue-plugin')
    return mod.VuePlugin
  }
}
