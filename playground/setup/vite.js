// @ts-check
import path from 'node:path'
import { createServer, version } from 'vite'
import { setupViteNode, logger } from './vite-node.js'
import colors from 'picocolors'
import minimist from 'minimist'

const dirname = path.dirname(new URL(import.meta.url).pathname)
main()

async function main() {
  logger.info('Starting server...', { timestamp: true })
  const runner = await setupViteNode(async () => {
    const VuePlugin = await getVuePlugin()
    server.config.inlineConfig.plugins = [VuePlugin]
    server.restart()
  })

  const VuePlugin = await getVuePlugin()
  const server = await startViteServer({
    plugins: [VuePlugin]
  })

  async function getVuePlugin() {
    /** @type { typeof import('./vue-plugin') } */
    const mod = await runner.executeId(path.resolve(dirname, 'vue-plugin.ts'))
    return mod.VuePlugin
  }
}

/**
 * @param {import('vite').InlineConfig} inlineConfig
 */
async function startViteServer(inlineConfig) {
  const args = minimist(process.argv.slice(2))
  const server = await createServer({
    configFile: args.c || args.config,
    logLevel: args.l || args.logLevel,
    optimizeDeps: { force: args.force },
    server: {
      host: args.host,
      port: args.port,
      open: args.open,
      cors: args.cors,
      strictPort: args.strictPort
    },
    ...inlineConfig
  })
  await server.listen()
  server.config.logger.info(
    `\n  ${colors.green(`${colors.bold('VITE')} v${version}`)}\n`
  )
  server.printUrls()
  server.bindCLIShortcuts({
    print: true
  })
  return server
}
