import { ref, watchEffect } from '@vue/runtime-dom'
import { renderEffect, setText, template } from '../src'
import { makeRender } from './_utils'
import type { VaporComponentInstance } from '../src/component'

const define = makeRender()

// TODO port tests from rendererComponent.spec.ts

describe('component', () => {
  test('unmountComponent', async () => {
    const { host, app, instance } = define(() => {
      const count = ref(0)
      const t0 = template('<div></div>')
      const n0 = t0()
      watchEffect(() => {
        setText(n0, count.value)
      })
      renderEffect(() => {})
      return n0
    }).render()

    const i = instance as VaporComponentInstance
    expect(i.scope.effects.length).toBe(2)
    expect(host.innerHTML).toBe('<div>0</div>')

    app.unmount()
    expect(host.innerHTML).toBe('')
    expect(i.scope.effects.length).toBe(0)
  })
})
