import {
  type InjectionKey,
  type Ref,
  createComponent,
  createTextNode,
  getCurrentInstance,
  inject,
  nextTick,
  onUpdated,
  provide,
  ref,
  renderEffect,
  setText,
} from '../src'
import { makeRender } from './_utils'

const define = makeRender<any>()

describe('apiLifecycle', () => {
  // TODO: test

  // #136
  test('should trigger updated hooks across components. (parent -> child)', async () => {
    const handleUpdated = vi.fn()
    const handleUpdatedChild = vi.fn()

    const count = ref(0)

    const { render, host } = define({
      setup() {
        onUpdated(() => handleUpdated())
        return (() => {
          const n0 = createTextNode()
          renderEffect(() => setText(n0, count.value))
          const n1 = createComponent(Child, { count: () => count.value })
          return [n0, n1]
        })()
      },
    })

    const Child = {
      props: { count: Number },
      setup() {
        onUpdated(() => handleUpdatedChild())
        return (() => {
          const props = getCurrentInstance()!.props
          const n2 = createTextNode()
          renderEffect(() => setText(n2, props.count))
          return n2
        })()
      },
    }

    render()

    expect(host.innerHTML).toBe('00')
    expect(handleUpdated).toHaveBeenCalledTimes(0)
    expect(handleUpdatedChild).toHaveBeenCalledTimes(0)

    count.value++
    await nextTick()
    expect(host.innerHTML).toBe('11')
    expect(handleUpdated).toHaveBeenCalledTimes(1)
    expect(handleUpdatedChild).toHaveBeenCalledTimes(1)
  })

  // #136
  test('should trigger updated hooks across components. (child -> parent)', async () => {
    const handleUpdated = vi.fn()
    const handleUpdatedChild = vi.fn()

    const key: InjectionKey<Ref<number>> = Symbol()

    const { render, host } = define({
      setup() {
        const count = ref(0)
        provide(key, count)
        onUpdated(() => handleUpdated())
        return (() => {
          const n0 = createTextNode()
          renderEffect(() => setText(n0, count.value))
          const n1 = createComponent(Child, { count: () => count.value })
          return [n0, n1]
        })()
      },
    })

    let update: any
    const Child = {
      props: { count: Number },
      setup() {
        onUpdated(() => handleUpdatedChild())
        const count = inject(key)!
        update = () => count.value++
        return (() => {
          const n2 = createTextNode()
          renderEffect(() => setText(n2, count.value))
          return n2
        })()
      },
    }

    render()

    expect(host.innerHTML).toBe('00')
    expect(handleUpdated).toHaveBeenCalledTimes(0)
    expect(handleUpdatedChild).toHaveBeenCalledTimes(0)

    update()
    await nextTick()
    expect(host.innerHTML).toBe('11')
    expect(handleUpdated).toHaveBeenCalledTimes(1)
    expect(handleUpdatedChild).toHaveBeenCalledTimes(1)
  })
})
