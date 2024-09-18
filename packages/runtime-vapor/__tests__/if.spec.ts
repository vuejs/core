import {
  children,
  createIf,
  insert,
  nextTick,
  ref,
  renderEffect,
  setText,
  template,
  withDirectives,
} from '../src'
import type { Mock } from 'vitest'
import { makeRender } from './_utils'
import { unmountComponent } from '../src/apiRender'

const define = makeRender()

describe('createIf', () => {
  test('basic', async () => {
    // mock this template:
    //  <div>
    //    <p v-if="counter">{{counter}}</p>
    //    <p v-else>zero</p>
    //  </div>

    let spyIfFn: Mock<any>
    let spyElseFn: Mock<any>
    const count = ref(0)

    const spyConditionFn = vi.fn(() => count.value)

    // templates can be reused through caching.
    const t0 = template('<div></div>')
    const t1 = template('<p></p>')
    const t2 = template('<p>zero</p>')

    const { host } = define(() => {
      const n0 = t0()

      insert(
        createIf(
          spyConditionFn,
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
    expect(spyConditionFn).toHaveBeenCalledTimes(1)
    expect(spyIfFn!).toHaveBeenCalledTimes(0)
    expect(spyElseFn!).toHaveBeenCalledTimes(1)

    count.value++
    await nextTick()
    expect(host.innerHTML).toBe('<div><p>1</p><!--if--></div>')
    expect(spyConditionFn).toHaveBeenCalledTimes(2)
    expect(spyIfFn!).toHaveBeenCalledTimes(1)
    expect(spyElseFn!).toHaveBeenCalledTimes(1)

    count.value++
    await nextTick()
    expect(host.innerHTML).toBe('<div><p>2</p><!--if--></div>')
    expect(spyConditionFn).toHaveBeenCalledTimes(3)
    expect(spyIfFn!).toHaveBeenCalledTimes(1)
    expect(spyElseFn!).toHaveBeenCalledTimes(1)

    count.value = 0
    await nextTick()
    expect(host.innerHTML).toBe('<div><p>zero</p><!--if--></div>')
    expect(spyConditionFn).toHaveBeenCalledTimes(4)
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

  test.todo('should work with directive hooks', async () => {
    const calls: string[] = []
    const show1 = ref(true)
    const show2 = ref(true)
    const update = ref(0)

    const spyConditionFn1 = vi.fn(() => show1.value)
    const spyConditionFn2 = vi.fn(() => show2.value)

    const vDirective: any = {
      created: (el: any, { value }: any) => calls.push(`${value} created`),
      beforeMount: (el: any, { value }: any) =>
        calls.push(`${value} beforeMount`),
      mounted: (el: any, { value }: any) => calls.push(`${value} mounted`),
      beforeUpdate: (el: any, { value }: any) =>
        calls.push(`${value} beforeUpdate`),
      updated: (el: any, { value }: any) => calls.push(`${value} updated`),
      beforeUnmount: (el: any, { value }: any) =>
        calls.push(`${value} beforeUnmount`),
      unmounted: (el: any, { value }: any) => calls.push(`${value} unmounted`),
    }

    const t0 = template('<p></p>')
    const { instance } = define(() => {
      const n1 = createIf(
        spyConditionFn1,
        () => {
          const n2 = t0()
          withDirectives(children(n2, 0), [
            [vDirective, () => (update.value, '1')],
          ])
          return n2
        },
        () =>
          createIf(
            spyConditionFn2,
            () => {
              const n2 = t0()
              withDirectives(children(n2, 0), [[vDirective, () => '2']])
              return n2
            },
            () => {
              const n2 = t0()
              withDirectives(children(n2, 0), [[vDirective, () => '3']])
              return n2
            },
          ),
      )
      return [n1]
    }).render()

    await nextTick()
    expect(calls).toEqual(['1 created', '1 beforeMount', '1 mounted'])
    calls.length = 0
    expect(spyConditionFn1).toHaveBeenCalledTimes(1)
    expect(spyConditionFn2).toHaveBeenCalledTimes(0)

    show1.value = false
    await nextTick()
    expect(calls).toEqual([
      '1 beforeUnmount',
      '2 created',
      '2 beforeMount',
      '1 unmounted',
      '2 mounted',
    ])
    calls.length = 0
    expect(spyConditionFn1).toHaveBeenCalledTimes(2)
    expect(spyConditionFn2).toHaveBeenCalledTimes(1)

    show2.value = false
    await nextTick()
    expect(calls).toEqual([
      '2 beforeUnmount',
      '3 created',
      '3 beforeMount',
      '2 unmounted',
      '3 mounted',
    ])
    calls.length = 0
    expect(spyConditionFn1).toHaveBeenCalledTimes(2)
    expect(spyConditionFn2).toHaveBeenCalledTimes(2)

    show1.value = true
    await nextTick()
    expect(calls).toEqual([
      '3 beforeUnmount',
      '1 created',
      '1 beforeMount',
      '3 unmounted',
      '1 mounted',
    ])
    calls.length = 0
    expect(spyConditionFn1).toHaveBeenCalledTimes(3)
    expect(spyConditionFn2).toHaveBeenCalledTimes(2)

    update.value++
    await nextTick()
    expect(calls).toEqual(['1 beforeUpdate', '1 updated'])
    calls.length = 0
    expect(spyConditionFn1).toHaveBeenCalledTimes(3)
    expect(spyConditionFn2).toHaveBeenCalledTimes(2)

    unmountComponent(instance!)
    expect(calls).toEqual(['1 beforeUnmount', '1 unmounted'])
    expect(spyConditionFn1).toHaveBeenCalledTimes(3)
    expect(spyConditionFn2).toHaveBeenCalledTimes(2)
  })
})
