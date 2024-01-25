import { defineComponent } from 'vue'
import {
  children,
  createIf,
  insert,
  nextTick,
  ref,
  render,
  renderEffect,
  setText,
  template,
} from '../src'
import { NOOP } from '@vue/shared'
import type { Mock } from 'vitest'

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

describe('createIf', () => {
  test('basic', async () => {
    // mock this template:
    //  <div>
    //    <p v-if="counter">{{counter}}</p>
    //    <p v-else>zero</p>
    //  </div>

    let spyIfFn: Mock<any, any>
    let spyElseFn: Mock<any, any>

    let add = NOOP
    let reset = NOOP

    // templates can be reused through caching.
    const t0 = template('<div></div>')
    const t1 = template('<p></p>')
    const t2 = template('<p>zero</p>')

    const component = defineComponent({
      setup() {
        const counter = ref(0)
        add = () => counter.value++
        reset = () => (counter.value = 0)

        // render
        return (() => {
          const n0 = t0()
          const {
            0: [n1],
          } = children(n0)

          insert(
            createIf(
              () => counter.value,
              // v-if
              (spyIfFn ||= vi.fn(() => {
                const n2 = t1()
                const {
                  0: [n3],
                } = children(n2)
                renderEffect(() => {
                  setText(n3, counter.value)
                })
                return n2
              })),
              // v-else
              (spyElseFn ||= vi.fn(() => {
                const n4 = t2()
                return n4
              })),
            ),
            n1,
          )
          return n0
        })()
      },
    })
    render(component as any, {}, '#host')

    expect(host.innerHTML).toBe('<div><p>zero</p><!--if--></div>')
    expect(spyIfFn!).toHaveBeenCalledTimes(0)
    expect(spyElseFn!).toHaveBeenCalledTimes(1)

    add()
    await nextTick()
    expect(host.innerHTML).toBe('<div><p>1</p><!--if--></div>')
    expect(spyIfFn!).toHaveBeenCalledTimes(1)
    expect(spyElseFn!).toHaveBeenCalledTimes(1)

    add()
    await nextTick()
    expect(host.innerHTML).toBe('<div><p>2</p><!--if--></div>')
    expect(spyIfFn!).toHaveBeenCalledTimes(1)
    expect(spyElseFn!).toHaveBeenCalledTimes(1)

    reset()
    await nextTick()
    expect(host.innerHTML).toBe('<div><p>zero</p><!--if--></div>')
    expect(spyIfFn!).toHaveBeenCalledTimes(1)
    expect(spyElseFn!).toHaveBeenCalledTimes(2)
  })
})
