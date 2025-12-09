import { createApp, vaporInteropPlugin } from 'vue'
import App from '../interop/App.vue'
import { E2E_TIMEOUT, css, nextFrame } from './e2eUtils'

describe('vdom / vapor interop', () => {
  let app: ReturnType<typeof createApp>
  beforeEach(() => {
    app = createApp(App).use(vaporInteropPlugin)
    app.mount('#app')
  })

  afterEach(() => {
    app.unmount()
  })

  test('should work', { timeout: E2E_TIMEOUT }, async () => {
    await expect
      .element(css('.vapor > h2'))
      .toHaveTextContent('Vapor component in VDOM')

    expect(css('.vapor-prop')).toHaveTextContent('hello')

    const l = css('.vdom-slot-in-vapor-default')
    expect(l).toHaveTextContent('slot prop: slot prop')
    expect(l).toHaveTextContent('component prop: hello')

    await css('.change-vdom-slot-in-vapor-prop').click()
    expect(css('.vdom-slot-in-vapor-default')).toHaveTextContent(
      'slot prop: changed',
    )

    expect(css('.vdom-slot-in-vapor-test')).toHaveTextContent('A test slot')

    await css('.toggle-vdom-slot-in-vapor').click()
    expect(css('.vdom-slot-in-vapor-test')).toHaveTextContent(
      'fallback content',
    )

    await css('.toggle-vdom-slot-in-vapor').click()
    expect(css('.vdom-slot-in-vapor-test')).toHaveTextContent('A test slot')

    expect(css('.vdom > h2')).toHaveTextContent('VDOM component in Vapor')

    expect(css('.vdom-prop')).toHaveTextContent('hello')

    const tt = css('.vapor-slot-in-vdom-default')
    expect(tt).toHaveTextContent('slot prop: slot prop')
    expect(tt).toHaveTextContent('component prop: hello')

    await css('.change-vapor-slot-in-vdom-prop').click()
    expect(css('.vapor-slot-in-vdom-default')).toHaveTextContent(
      'slot prop: changed',
    )

    expect(css('.vapor-slot-in-vdom-test')).toHaveTextContent('fallback')

    await css('.toggle-vapor-slot-in-vdom-default').click()
    expect(css('.vapor-slot-in-vdom-default')).toHaveTextContent(
      'default slot fallback',
    )

    await css('.toggle-vapor-slot-in-vdom-default').click()

    await css('input').fill('bye')
    expect(css('.vapor-prop')).toHaveTextContent('bye')
    expect(css('.vdom-slot-in-vapor-default')).toHaveTextContent('bye')
    expect(css('.vdom-prop')).toHaveTextContent('bye')
    expect(css('.vapor-slot-in-vdom-default')).toHaveTextContent('bye')
  })

  describe('vdom transition', () => {
    test('render vapor component', { timeout: E2E_TIMEOUT }, async () => {
      const btnSelector = '.trans-vapor > button'
      const containerSelector = '.trans-vapor > div'

      expect(css(containerSelector).element().innerHTML).toBe(
        `<div>vapor compA</div>`,
      )

      // comp leave
      await css(btnSelector).click()
      expect(css(containerSelector).element().innerHTML).toBe(
        `<div class="v-leave-from v-leave-active">vapor compA</div><!--v-if-->`,
      )

      // await nextFrame()
      // expect(css(containerSelector).element().innerHTML).toBe(
      //   `<div class="v-leave-active v-leave-to">vapor compA</div><!--v-if-->`,
      // )

      // await transitionFinish()
      // expect(await html(containerSelector)).toBe(`<!---->`)

      // // comp enter
      // expect(
      //   (await transitionStart(btnSelector, containerSelector)).innerHTML,
      // ).toBe(`<div class="v-enter-from v-enter-active">vapor compA</div>`)

      // await nextFrame()
      // expect(await html(containerSelector)).toBe(
      //   `<div class="v-enter-active v-enter-to">vapor compA</div>`,
      // )

      // await transitionFinish()
      // expect(await html(containerSelector)).toBe(
      //   `<div class="">vapor compA</div>`,
      // )
    })

    test.todo(
      'switch between vdom/vapor component (out-in mode)',
      { timeout: E2E_TIMEOUT },
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
    )
  })

  describe.todo('vdom transition-group', () => {
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
