import path from 'node:path'
import connect from 'connect'
import sirv from 'sirv'

export type E2ETestServer = {
  port: number
  close: () => void
}

export async function startE2ETestServer(
  testName: string,
  dirname: string,
): Promise<E2ETestServer> {
  const app = connect().use(sirv(path.resolve(dirname, '../dist')))
  let server: any
  let port = 0

  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error(`[${testName}] failed to bind e2e server port`))
        return
      }
      port = address.port
      resolve()
    })
    server.once('error', reject)
  })

  const onSigterm = () => server && server.close()
  process.on('SIGTERM', onSigterm)

  return {
    port,
    close: () => {
      process.off('SIGTERM', onSigterm)
      server.close()
    },
  }
}
