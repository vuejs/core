import { ref, setText, template, watchEffect } from '../src'
import { describe, expect } from 'vitest'
import { makeRender } from './_utils'

const define = makeRender()

describe('component', () => {
  test('unmountComponent', async () => {
    const { host, app } = define(() => {
      const count = ref(0)
      const t0 = template('<div></div>')
      const n0 = t0()
      watchEffect(() => {
        setText(n0, count.value)
      })
      return n0
    }).render()
    expect(host.innerHTML).toBe('<div>0</div>')
    app.unmount()
    expect(host.innerHTML).toBe('')
  })
})
