import path from 'node:path'
import {
  E2E_TIMEOUT,
  setupPuppeteer,
  timeout,
} from '../../../packages/vue/__tests__/e2e/e2eUtils'
import connect from 'connect'
import sirv from 'sirv'
const { page, click, text, enterValue, html } = setupPuppeteer()

const duration = process.env.CI ? 200 : 50

describe('vdom / vapor interop', () => {
  let server: any
  const port = '8193'
  beforeAll(() => {
    server = connect()
      .use(sirv(path.resolve(import.meta.dirname, '../dist')))
      .listen(port)
    process.on('SIGTERM', () => server && server.close())
  })

  afterAll(() => {
    server.close()
  })

  beforeEach(async () => {
    const baseUrl = `http://localhost:${port}/interop/`
    await page().goto(baseUrl)
    await page().waitForSelector('#app')
  })

  test(
    'should work',
    async () => {
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

  describe('async component', () => {
    const container = '.async-component-interop'
    test(
      'with-vdom-inner-component',
      async () => {
        const testContainer = `${container} .with-vdom-component`
        expect(await html(testContainer)).toBe('<span>loading...</span>')

        await timeout(duration)
        expect(await html(testContainer)).toBe('<div> foo </div>')
      },
      E2E_TIMEOUT,
    )
  })
})
