import {
  createIf,
  insert,
  nextTick,
  ref,
  renderEffect,
  setText,
  template,
} from '../src'
import type { Mock } from 'vitest'
import { makeRender } from './_utils'

const define = makeRender()

describe('createIf', () => {
  test('basic', async () => {
    // mock this template:
    //  <div>
    //    <p v-if="counter">{{counter}}</p>
    //    <p v-else>zero</p>
    //  </div>

    let spyIfFn: Mock<any, any>
    let spyElseFn: Mock<any, any>
    const count = ref(0)

    // templates can be reused through caching.
    const t0 = template('<div></div>')
    const t1 = template('<p></p>')
    const t2 = template('<p>zero</p>')

    const { host } = define(() => {
      const n0 = t0()

      insert(
        createIf(
          () => count.value,
          // v-if
          (spyIfFn ||= vi.fn(() => {
            const n2 = t1()
            renderEffect(() => {
              setText(n2, count.value)
            })
            return n2
          })),
          // v-else
          (spyElseFn ||= vi.fn(() => {
            const n4 = t2()
            return n4
          })),
        ),
        n0 as any as ParentNode,
      )
      return n0
    }).render()

    expect(host.innerHTML).toBe('<div><p>zero</p><!--if--></div>')
    expect(spyIfFn!).toHaveBeenCalledTimes(0)
    expect(spyElseFn!).toHaveBeenCalledTimes(1)

    count.value++
    await nextTick()
    expect(host.innerHTML).toBe('<div><p>1</p><!--if--></div>')
    expect(spyIfFn!).toHaveBeenCalledTimes(1)
    expect(spyElseFn!).toHaveBeenCalledTimes(1)

    count.value++
    await nextTick()
    expect(host.innerHTML).toBe('<div><p>2</p><!--if--></div>')
    expect(spyIfFn!).toHaveBeenCalledTimes(1)
    expect(spyElseFn!).toHaveBeenCalledTimes(1)

    count.value = 0
    await nextTick()
    expect(host.innerHTML).toBe('<div><p>zero</p><!--if--></div>')
    expect(spyIfFn!).toHaveBeenCalledTimes(1)
    expect(spyElseFn!).toHaveBeenCalledTimes(2)
  })

  test('should handle nested template', async () => {
    // mock this template:
    //  <template v-if="ok1">
    //    Hello <template v-if="ok2">Vapor</template>
    //  </template>

    const ok1 = ref(true)
    const ok2 = ref(true)

    const t0 = template('Vapor')
    const t1 = template('Hello ')
    const { host } = define(() => {
      const n1 = createIf(
        () => ok1.value,
        () => {
          const n2 = t1()
          const n3 = createIf(
            () => ok2.value,
            () => {
              const n4 = t0()
              return n4
            },
          )
          return [n2, n3]
        },
      )
      return n1
    }).render()

    expect(host.innerHTML).toBe('Hello Vapor<!--if--><!--if-->')

    ok1.value = false
    await nextTick()
    expect(host.innerHTML).toBe('<!--if-->')

    ok1.value = true
    await nextTick()
    expect(host.innerHTML).toBe('Hello Vapor<!--if--><!--if-->')

    ok2.value = false
    await nextTick()
    expect(host.innerHTML).toBe('Hello <!--if--><!--if-->')

    ok1.value = false
    await nextTick()
    expect(host.innerHTML).toBe('<!--if-->')
  })
})
