import { createServer, createLogger } from 'vite'
import { ViteNodeServer } from 'vite-node/server'
import { ViteNodeRunner } from 'vite-node/client'
import { reload } from 'vite-node/hmr'
import { installSourcemapsSupport } from 'vite-node/source-map'
import { DevPlugin } from './dev'

const logger = createLogger(undefined, {
  prefix: '[vite-node]',
  allowClearScreen: false
})

export async function setupViteNode(onUpdate: () => void) {
  const server = await createServer({
    configFile: false,
    optimizeDeps: { disabled: true },
    plugins: [
      DevPlugin(),
      {
        name: 'hmr',
        async handleHotUpdate({ modules }) {
          if (modules.length === 0) return
          await reload(runner, [])
          onUpdate()
        }
      }
    ],
    customLogger: logger
  })
  await server.pluginContainer.buildStart({})
  const node = new ViteNodeServer(server, {
    deps: {
      inline: ['@vitejs/plugin-vue']
    }
  })
  installSourcemapsSupport({
    getSourceMap: source => node.getSourceMap(source)
  })

  const runner = new ViteNodeRunner({
    root: server.config.root,
    base: server.config.base,
    fetchModule(id) {
      return node.fetchModule(id)
    },
    async resolveId(id, importer) {
      return node.resolveId(id, importer)
    }
  })

  return runner
}
