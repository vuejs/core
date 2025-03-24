import path from 'node:path'
import {
  E2E_TIMEOUT,
  setupPuppeteer,
} from '../../../packages/vue/__tests__/e2e/e2eUtils'
import connect from 'connect'
import sirv from 'sirv'
import { ports } from '../utils'

describe('vdom / vapor interop', () => {
  const { page, click, text, enterValue } = setupPuppeteer()

  let server: any
  const port = ports.vdomInterop
  beforeAll(() => {
    server = connect()
      .use(sirv(path.resolve(import.meta.dirname, '../dist')))
      .listen(port)
    process.on('SIGTERM', () => server && server.close())
  })

  afterAll(() => {
    server.close()
  })

  test(
    'should work',
    async () => {
      const baseUrl = `http://localhost:${port}/interop/`
      await page().goto(baseUrl)

      expect(await text('.vapor > h2')).toContain('Vapor component in VDOM')

      expect(await text('.vapor-prop')).toContain('hello')

      const t = await text('.vdom-slot-in-vapor-default')
      expect(t).toContain('slot prop: slot prop')
      expect(t).toContain('component prop: hello')

      await click('.change-vdom-slot-in-vapor-prop')
      expect(await text('.vdom-slot-in-vapor-default')).toContain(
        'slot prop: changed',
      )

      expect(await text('.vdom-slot-in-vapor-test')).toContain('A test slot')

      await click('.toggle-vdom-slot-in-vapor')
      expect(await text('.vdom-slot-in-vapor-test')).toContain(
        'fallback content',
      )

      await click('.toggle-vdom-slot-in-vapor')
      expect(await text('.vdom-slot-in-vapor-test')).toContain('A test slot')

      expect(await text('.vdom > h2')).toContain('VDOM component in Vapor')

      expect(await text('.vdom-prop')).toContain('hello')

      const tt = await text('.vapor-slot-in-vdom-default')
      expect(tt).toContain('slot prop: slot prop')
      expect(tt).toContain('component prop: hello')

      await click('.change-vapor-slot-in-vdom-prop')
      expect(await text('.vapor-slot-in-vdom-default')).toContain(
        'slot prop: changed',
      )

      expect(await text('.vapor-slot-in-vdom-test')).toContain('fallback')

      await click('.toggle-vapor-slot-in-vdom-default')
      expect(await text('.vapor-slot-in-vdom-default')).toContain(
        'default slot fallback',
      )

      await click('.toggle-vapor-slot-in-vdom-default')

      await enterValue('input', 'bye')
      expect(await text('.vapor-prop')).toContain('bye')
      expect(await text('.vdom-slot-in-vapor-default')).toContain('bye')
      expect(await text('.vdom-prop')).toContain('bye')
      expect(await text('.vapor-slot-in-vdom-default')).toContain('bye')
    },
    E2E_TIMEOUT,
  )
})
