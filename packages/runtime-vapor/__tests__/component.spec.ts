import { ref, setText, template, unmountComponent, watchEffect } from '../src'
import { describe, expect } from 'vitest'
import { makeRender } from './_utils'

const define = makeRender()

describe('component', () => {
  test('unmountComponent', async () => {
    const { host, instance } = define(() => {
      const count = ref(0)
      const t0 = template('<div></div>')
      const n0 = t0()
      watchEffect(() => {
        setText(n0, count.value)
      })
      return n0
    }).render()
    expect(host.innerHTML).toBe('<div>0</div>')
    unmountComponent(instance)
    expect(host.innerHTML).toBe('')
  })
})
