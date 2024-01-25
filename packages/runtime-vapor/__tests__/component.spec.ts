import {
  children,
  ref,
  render,
  setText,
  template,
  unmountComponent,
  watchEffect,
} from '../src'
import { afterEach, beforeEach, describe, expect } from 'vitest'
import { defineComponent } from '@vue/runtime-core'

let host: HTMLElement

const initHost = () => {
  host = document.createElement('div')
  host.setAttribute('id', 'host')
  document.body.appendChild(host)
}
beforeEach(() => {
  initHost()
})
afterEach(() => {
  host.remove()
})
describe('component', () => {
  test('unmountComponent', async () => {
    const Comp = defineComponent({
      setup() {
        const count = ref(0)
        const t0 = template('<div></div>')
        const n0 = t0()
        const {
          0: [n1],
        } = children(n0)
        watchEffect(() => {
          setText(n1, count.value)
        })
        return n0
      },
    })
    const instance = render(Comp as any, {}, '#host')
    expect(host.innerHTML).toBe('<div>0</div>')
    unmountComponent(instance)
    expect(host.innerHTML).toBe('')
  })
})
