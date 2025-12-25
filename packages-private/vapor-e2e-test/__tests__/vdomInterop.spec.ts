import path from 'node:path'
import {
  E2E_TIMEOUT,
  setupPuppeteer,
} from '../../../packages/vue/__tests__/e2e/e2eUtils'
import connect from 'connect'
import sirv from 'sirv'
const {
  page,
  click,
  text,
  enterValue,
  html,
  transitionStart,
  waitForElement,
  nextFrame,
  timeout,
} = setupPuppeteer()

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

const duration = process.env.CI ? 200 : 50
const buffer = process.env.CI ? 50 : 20
const transitionFinish = (time = duration) => timeout(time + buffer)

describe('vdom / vapor interop', () => {
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

  describe('vdom transition', () => {
    test(
      'render vapor component',
      async () => {
        const btnSelector = '.trans-vapor > button'
        const containerSelector = '.trans-vapor > div'

        expect(await html(containerSelector)).toBe(`<div>vapor compA</div>`)

        // comp leave
        expect(
          (await transitionStart(btnSelector, containerSelector)).innerHTML,
        ).toBe(
          `<div class="v-leave-from v-leave-active">vapor compA</div><!---->`,
        )

        await nextFrame()
        expect(await html(containerSelector)).toBe(
          `<div class="v-leave-active v-leave-to">vapor compA</div><!---->`,
        )

        await transitionFinish()
        expect(await html(containerSelector)).toBe(`<!---->`)

        // comp enter
        expect(
          (await transitionStart(btnSelector, containerSelector)).innerHTML,
        ).toBe(`<div class="v-enter-from v-enter-active">vapor compA</div>`)

        await nextFrame()
        expect(await html(containerSelector)).toBe(
          `<div class="v-enter-active v-enter-to">vapor compA</div>`,
        )

        await transitionFinish()
        expect(await html(containerSelector)).toBe(
          `<div class="">vapor compA</div>`,
        )
      },
      E2E_TIMEOUT,
    )

    test(
      'switch between vdom/vapor component (out-in mode)',
      async () => {
        const btnSelector = '.trans-vdom-vapor-out-in > button'
        const containerSelector = '.trans-vdom-vapor-out-in > div'
        const childSelector = `${containerSelector} > div`

        expect(await html(containerSelector)).toBe(`<div>vdom comp</div>`)

        // switch to vapor comp
        // vdom comp leave
        expect(
          (await transitionStart(btnSelector, containerSelector)).innerHTML,
        ).toBe(
          `<div class="fade-leave-from fade-leave-active">vdom comp</div><!---->`,
        )

        await nextFrame()
        expect(await html(containerSelector)).toBe(
          `<div class="fade-leave-active fade-leave-to">vdom comp</div><!---->`,
        )

        // vapor comp enter
        await waitForElement(childSelector, 'vapor compA', [
          'fade-enter-from',
          'fade-enter-active',
        ])

        await nextFrame()
        expect(await html(containerSelector)).toBe(
          `<div class="fade-enter-active fade-enter-to">vapor compA</div>`,
        )

        await transitionFinish()
        expect(await html(containerSelector)).toBe(
          `<div class="">vapor compA</div>`,
        )

        // switch to vdom comp
        // vapor comp leave
        expect(
          (await transitionStart(btnSelector, containerSelector)).innerHTML,
        ).toBe(
          `<div class="fade-leave-from fade-leave-active">vapor compA</div><!---->`,
        )

        await nextFrame()
        expect(await html(containerSelector)).toBe(
          `<div class="fade-leave-active fade-leave-to">vapor compA</div><!---->`,
        )

        // vdom comp enter
        await waitForElement(childSelector, 'vdom comp', [
          'fade-enter-from',
          'fade-enter-active',
        ])

        await nextFrame()
        expect(await html(containerSelector)).toBe(
          `<div class="fade-enter-active fade-enter-to">vdom comp</div>`,
        )

        await transitionFinish()
        expect(await html(containerSelector)).toBe(
          `<div class="">vdom comp</div>`,
        )
      },
      E2E_TIMEOUT,
    )
  })

  describe('vdom transition-group', () => {
    test(
      'render vapor component',
      async () => {
        const btnSelector = '.trans-group-vapor > button'
        const containerSelector = '.trans-group-vapor > div'

        expect(await html(containerSelector)).toBe(
          `<div><div>a</div></div>` +
            `<div><div>b</div></div>` +
            `<div><div>c</div></div>`,
        )

        // insert
        expect(
          (await transitionStart(btnSelector, containerSelector)).innerHTML,
        ).toBe(
          `<div><div>a</div></div>` +
            `<div><div>b</div></div>` +
            `<div><div>c</div></div>` +
            `<div class="test-enter-from test-enter-active"><div>d</div></div>` +
            `<div class="test-enter-from test-enter-active"><div>e</div></div>`,
        )

        await nextFrame()
        expect(await html(containerSelector)).toBe(
          `<div><div>a</div></div>` +
            `<div><div>b</div></div>` +
            `<div><div>c</div></div>` +
            `<div class="test-enter-active test-enter-to"><div>d</div></div>` +
            `<div class="test-enter-active test-enter-to"><div>e</div></div>`,
        )

        await transitionFinish()
        expect(await html(containerSelector)).toBe(
          `<div><div>a</div></div>` +
            `<div><div>b</div></div>` +
            `<div><div>c</div></div>` +
            `<div class=""><div>d</div></div>` +
            `<div class=""><div>e</div></div>`,
        )
      },
      E2E_TIMEOUT,
    )
  })
})
