import { createApp, vaporInteropPlugin } from 'vue'
import App from '../interop/App.vue'
import { E2E_TIMEOUT, css } from './e2eUtils'

describe('vdom / vapor interop', () => {
  test('should work', { timeout: E2E_TIMEOUT }, async () => {
    createApp(App).use(vaporInteropPlugin).mount('#app')

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
})
