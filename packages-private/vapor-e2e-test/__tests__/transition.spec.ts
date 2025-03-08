import path from 'node:path'
import {
  E2E_TIMEOUT,
  setupPuppeteer,
} from '../../../packages/vue/__tests__/e2e/e2eUtils'
import connect from 'connect'
import sirv from 'sirv'
const {
  page,
  classList,
  text,
  nextFrame,
  timeout,
  isVisible,
  count,
  html,
  transitionStart,
  waitForElement,
} = setupPuppeteer()

const duration = process.env.CI ? 200 : 50
const buffer = process.env.CI ? 50 : 20
const transitionFinish = (time = duration) => timeout(time + buffer)

describe('vapor transition', () => {
  let server: any
  const port = '8195'
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
    const baseUrl = `http://localhost:${port}/transition/`
    await page().goto(baseUrl)
    await page().waitForSelector('#app')
  })

  test(
    'should work with v-show',
    async () => {
      const btnSelector = '.vshow > button'
      const containerSelector = '.vshow > h1'

      expect(await text(containerSelector)).toContain('vShow')

      // leave
      expect(
        (await transitionStart(btnSelector, containerSelector)).classNames,
      ).toStrictEqual(['v-leave-from', 'v-leave-active'])

      await nextFrame()
      expect(await classList(containerSelector)).toStrictEqual([
        'v-leave-active',
        'v-leave-to',
      ])

      await transitionFinish()
      await nextFrame()
      expect(await isVisible(containerSelector)).toBe(false)

      // enter
      expect(
        (await transitionStart(btnSelector, containerSelector)).classNames,
      ).toStrictEqual(['v-enter-from', 'v-enter-active'])

      await nextFrame()
      expect(await classList(containerSelector)).toStrictEqual([
        'v-enter-active',
        'v-enter-to',
      ])

      await transitionFinish()
      await nextFrame()
      expect(await isVisible(containerSelector)).toBe(true)
    },
    E2E_TIMEOUT,
  )

  test(
    'should work with v-if + appear',
    async () => {
      const btnSelector = '.vif > button'
      const containerSelector = '.vif > h1'

      // appear
      expect(await classList(containerSelector)).contains('v-enter-active')
      expect(await text(containerSelector)).toContain('vIf')
      await transitionFinish()

      // leave
      await nextFrame()
      expect(
        (await transitionStart(btnSelector, containerSelector)).classNames,
      ).toStrictEqual(['v-leave-from', 'v-leave-active'])

      await nextFrame()
      expect(await classList(containerSelector)).toStrictEqual([
        'v-leave-active',
        'v-leave-to',
      ])

      await transitionFinish()
      expect(await count(containerSelector)).toBe(0)

      // enter
      expect(
        (await transitionStart(btnSelector, containerSelector)).classNames,
      ).toStrictEqual(['v-enter-from', 'v-enter-active'])

      await nextFrame()
      expect(await classList(containerSelector)).toStrictEqual([
        'v-enter-active',
        'v-enter-to',
      ])

      await transitionFinish()
      await nextFrame()
      expect(await isVisible(containerSelector)).toBe(true)

      const calls = await page().evaluate(() => {
        return (window as any).calls
      })

      expect(calls).toStrictEqual([
        'beforeAppear',
        'onEnter',
        'afterAppear',
        'beforeLeave',
        'onLeave',
        'afterLeave',
        'beforeEnter',
        'onEnter',
        'afterEnter',
      ])
    },
    E2E_TIMEOUT,
  )

  test(
    'should work with keyed element',
    async () => {
      const btnSelector = '.keyed > button'
      const containerSelector = '.keyed > h1'

      expect(await text(containerSelector)).toContain('0')

      // change key
      expect(
        (await transitionStart(btnSelector, containerSelector)).classNames,
      ).toStrictEqual(['v-leave-from', 'v-leave-active'])

      await nextFrame()
      expect(await classList(containerSelector)).toStrictEqual([
        'v-leave-active',
        'v-leave-to',
      ])

      await transitionFinish()
      await nextFrame()
      expect(await text(containerSelector)).toContain('1')

      // change key again
      expect(
        (await transitionStart(btnSelector, containerSelector)).classNames,
      ).toStrictEqual(['v-leave-from', 'v-leave-active'])

      await nextFrame()
      expect(await classList(containerSelector)).toStrictEqual([
        'v-leave-active',
        'v-leave-to',
      ])

      await transitionFinish()
      await nextFrame()
      expect(await text(containerSelector)).toContain('2')
    },
    E2E_TIMEOUT,
  )

  test(
    'should work with out-in mode',
    async () => {
      const btnSelector = '.out-in > button'
      const containerSelector = '.out-in > div'
      const childSelector = `${containerSelector} > div`

      expect(await html(containerSelector)).toBe(`<div>vapor compB</div>`)

      // compB -> compA
      // compB leave
      expect(
        (await transitionStart(btnSelector, containerSelector)).innerHTML,
      ).toBe(`<div class="fade-leave-from fade-leave-active">vapor compB</div>`)

      await nextFrame()
      expect(await html(containerSelector)).toBe(
        `<div class="fade-leave-active fade-leave-to">vapor compB</div>`,
      )

      // compA enter
      await waitForElement(childSelector, 'vapor compA', [
        'fade-enter-from',
        'fade-enter-active',
      ])

      await nextFrame()
      expect(await html(containerSelector)).toBe(
        `<div class="fade-enter-active fade-enter-to">vapor compA</div>`,
      )

      await transitionFinish()
      await nextFrame()
      expect(await html(containerSelector)).toBe(
        `<div class="">vapor compA</div>`,
      )

      // compA -> compB
      // compA leave
      expect(
        (await transitionStart(btnSelector, containerSelector)).innerHTML,
      ).toBe(`<div class="fade-leave-from fade-leave-active">vapor compA</div>`)

      await nextFrame()
      expect(await html(containerSelector)).toBe(
        `<div class="fade-leave-active fade-leave-to">vapor compA</div>`,
      )

      // compB enter
      await waitForElement(childSelector, 'vapor compB', [
        'fade-enter-from',
        'fade-enter-active',
      ])

      await nextFrame()
      expect(await html(containerSelector)).toBe(
        `<div class="fade-enter-active fade-enter-to">vapor compB</div>`,
      )

      await transitionFinish()
      expect(await html(containerSelector)).toBe(
        `<div class="">vapor compB</div>`,
      )
    },
    E2E_TIMEOUT,
  )

  test(
    'should work with in-out mode',
    async () => {
      const btnSelector = '.in-out > button'
      const containerSelector = '.in-out > div'
      const childSelector = `${containerSelector} > div`

      expect(await html(containerSelector)).toBe(`<div>vapor compB</div>`)

      // compA enter
      expect(
        (await transitionStart(btnSelector, containerSelector)).innerHTML,
      ).toBe(
        `<div>vapor compB</div><div class="fade-enter-from fade-enter-active">vapor compA</div>`,
      )

      await nextFrame()
      expect(await html(containerSelector)).toBe(
        `<div>vapor compB</div><div class="fade-enter-active fade-enter-to">vapor compA</div>`,
      )

      // compB leave
      await waitForElement(childSelector, 'vapor compB', [
        'fade-leave-from',
        'fade-leave-active',
      ])

      await nextFrame()
      expect(await html(containerSelector)).toBe(
        `<div class="fade-leave-active fade-leave-to">vapor compB</div><div class="">vapor compA</div>`,
      )

      await transitionFinish()
      expect(await html(containerSelector)).toBe(
        `<div class="">vapor compA</div>`,
      )
    },
    E2E_TIMEOUT,
  )

  // tests for using vdom component in createVaporApp + vaporInteropPlugin
  describe('interop', () => {
    test(
      'render vdom component',
      async () => {
        const btnSelector = '.vdom > button'
        const containerSelector = '.vdom > div'

        expect(await html(containerSelector)).toBe(`<div>vdom comp</div>`)

        // comp leave
        expect(
          (await transitionStart(btnSelector, containerSelector)).innerHTML,
        ).toBe(`<div class="v-leave-from v-leave-active">vdom comp</div>`)

        await nextFrame()
        expect(await html(containerSelector)).toBe(
          `<div class="v-leave-active v-leave-to">vdom comp</div>`,
        )

        await transitionFinish()
        expect(await html(containerSelector)).toBe(``)

        // comp enter
        expect(
          (await transitionStart(btnSelector, containerSelector)).innerHTML,
        ).toBe(`<div class="v-enter-from v-enter-active">vdom comp</div>`)

        await nextFrame()
        expect(await html(containerSelector)).toBe(
          `<div class="v-enter-active v-enter-to">vdom comp</div>`,
        )

        await transitionFinish()
        expect(await html(containerSelector)).toBe(
          `<div class="">vdom comp</div>`,
        )
      },
      E2E_TIMEOUT,
    )

    test(
      'switch between vdom/vapor component (out-in mode)',
      async () => {
        const btnSelector = '.vdom-vapor-out-in > button'
        const containerSelector = '.vdom-vapor-out-in > div'
        const childSelector = `${containerSelector} > div`

        expect(await html(containerSelector)).toBe(`<div>vdom comp</div>`)

        // switch to vapor comp
        // vdom comp leave
        expect(
          (await transitionStart(btnSelector, containerSelector)).innerHTML,
        ).toBe(`<div class="fade-leave-from fade-leave-active">vdom comp</div>`)

        await nextFrame()
        expect(await html(containerSelector)).toBe(
          `<div class="fade-leave-active fade-leave-to">vdom comp</div>`,
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
          `<div class="fade-leave-from fade-leave-active">vapor compA</div>`,
        )

        await nextFrame()
        expect(await html(containerSelector)).toBe(
          `<div class="fade-leave-active fade-leave-to">vapor compA</div>`,
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

    test(
      'switch between vdom/vapor component (in-out mode)',
      async () => {
        const btnSelector = '.vdom-vapor-in-out > button'
        const containerSelector = '.vdom-vapor-in-out > div'
        const childSelector = `${containerSelector} > div`

        expect(await html(containerSelector)).toBe(`<div>vapor compA</div>`)

        // switch to vdom comp
        // vdom comp enter
        expect(
          (await transitionStart(btnSelector, containerSelector)).innerHTML,
        ).toBe(
          `<div>vapor compA</div><div class="fade-enter-from fade-enter-active">vdom comp</div>`,
        )

        await nextFrame()
        expect(await html(containerSelector)).toBe(
          `<div>vapor compA</div><div class="fade-enter-active fade-enter-to">vdom comp</div>`,
        )

        // vapor comp leave
        await waitForElement(childSelector, 'vapor compA', [
          'fade-leave-from',
          'fade-leave-active',
        ])

        await nextFrame()
        expect(await html(containerSelector)).toBe(
          `<div class="fade-leave-active fade-leave-to">vapor compA</div><div class="">vdom comp</div>`,
        )

        await transitionFinish()
        expect(await html(containerSelector)).toBe(
          `<div class="">vdom comp</div>`,
        )

        // switch to vapor comp
        // vapor comp enter
        expect(
          (await transitionStart(btnSelector, containerSelector)).innerHTML,
        ).toBe(
          `<div class="">vdom comp</div><div class="fade-enter-from fade-enter-active">vapor compA</div>`,
        )

        await nextFrame()
        expect(await html(containerSelector)).toBe(
          `<div class="">vdom comp</div><div class="fade-enter-active fade-enter-to">vapor compA</div>`,
        )

        // vdom comp leave
        await waitForElement(childSelector, 'vdom comp', [
          'fade-leave-from',
          'fade-leave-active',
        ])

        await nextFrame()
        expect(await html(containerSelector)).toBe(
          `<div class="fade-leave-active fade-leave-to">vdom comp</div><div class="">vapor compA</div>`,
        )

        await transitionFinish()
        expect(await html(containerSelector)).toBe(
          `<div class="">vapor compA</div>`,
        )
      },
      E2E_TIMEOUT,
    )
  })
})
