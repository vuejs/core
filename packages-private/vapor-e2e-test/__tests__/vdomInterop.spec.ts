import { createApp, vaporInteropPlugin } from 'vue'
import App from '../interop/App.vue'
import '../transition/style.css'
import {
  E2E_TIMEOUT,
  css,
  expectTransitionSnapshotSequence,
  transitionFinish,
} from './e2eUtils'

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
  expect(css('.vdom-slot-in-vapor-test')).toHaveTextContent('fallback content')

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

    await expect
      .element(css(containerSelector))
      .toContainHTML(`<div>vapor compA</div>`)

    // comp leave
    await expectTransitionSnapshotSequence(btnSelector, containerSelector, [
      `<div class="v-leave-from v-leave-active">vapor compA</div><!--v-if-->`,
      `<div class="v-leave-active v-leave-to">vapor compA</div><!--v-if-->`,
    ])

    await transitionFinish()
    await expect.element(css(containerSelector)).toContainHTML(`<!--v-if-->`)

    // comp enter
    await expectTransitionSnapshotSequence(btnSelector, containerSelector, [
      `<div class="v-enter-from v-enter-active">vapor compA</div>`,
      `<div class="v-enter-active v-enter-to">vapor compA</div>`,
    ])

    await transitionFinish()
    await expect
      .element(css(containerSelector))
      .toContainHTML(`<div class="">vapor compA</div>`)
  })

  test(
    'switch between vdom/vapor component (out-in mode)',
    { timeout: E2E_TIMEOUT },
    async () => {
      const btnSelector = '.trans-vdom-vapor-out-in > button'
      const containerSelector = '.trans-vdom-vapor-out-in > div'

      await expect
        .element(css(containerSelector))
        .toContainHTML(`<div>vdom comp</div>`)

      // switch to vapor comp
      await expectTransitionSnapshotSequence(btnSelector, containerSelector, [
        `<div class="fade-leave-from fade-leave-active">vdom comp</div><!---->`,
        `<div class="fade-leave-active fade-leave-to">vdom comp</div><!---->`,
        `<div class="fade-enter-from fade-enter-active">vapor compA</div>`,
        `<div class="fade-enter-active fade-enter-to">vapor compA</div>`,
      ])

      await transitionFinish()
      await expect
        .element(css(containerSelector))
        .toContainHTML(`<div class="">vapor compA</div>`)

      // switch to vdom comp
      await expectTransitionSnapshotSequence(btnSelector, containerSelector, [
        `<div class="fade-leave-from fade-leave-active">vapor compA</div><!---->`,
        `<div class="fade-leave-active fade-leave-to">vapor compA</div><!---->`,
        `<div class="fade-enter-from fade-enter-active">vdom comp</div>`,
        `<div class="fade-enter-active fade-enter-to">vdom comp</div>`,
      ])

      await transitionFinish()
      await expect
        .element(css(containerSelector))
        .toContainHTML(`<div class="">vdom comp</div>`)
    },
  )
})

describe('vdom transition-group', () => {
  test('render vapor component', { timeout: E2E_TIMEOUT }, async () => {
    const btnSelector = '.trans-group-vapor > button'
    const containerSelector = '.trans-group-vapor > div'

    await expect
      .element(css(containerSelector))
      .toContainHTML(
        `<div><div>a</div></div>` +
          `<div><div>b</div></div>` +
          `<div><div>c</div></div>`,
      )

    // insert
    await expectTransitionSnapshotSequence(btnSelector, containerSelector, [
      `<div><div>a</div></div>` +
        `<div><div>b</div></div>` +
        `<div><div>c</div></div>` +
        `<div class="test-enter-from test-enter-active"><div>d</div></div>` +
        `<div class="test-enter-from test-enter-active"><div>e</div></div>`,
      `<div><div>a</div></div>` +
        `<div><div>b</div></div>` +
        `<div><div>c</div></div>` +
        `<div class="test-enter-active test-enter-to"><div>d</div></div>` +
        `<div class="test-enter-active test-enter-to"><div>e</div></div>`,
    ])

    await transitionFinish()
    await expect
      .element(css(containerSelector))
      .toContainHTML(
        `<div><div>a</div></div>` +
          `<div><div>b</div></div>` +
          `<div><div>c</div></div>` +
          `<div class=""><div>d</div></div>` +
          `<div class=""><div>e</div></div>`,
      )
  })
})
