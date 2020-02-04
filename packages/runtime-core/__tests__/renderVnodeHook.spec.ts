import { h } from '../src/h'
import { nextTick, nodeOps, ref, render } from '@vue/runtime-test'

describe('renderer: vnode hook', () => {
  test('element', async () => {
    const onVnodeBeforeMount = jest.fn()
    const onVnodeMounted = jest.fn()
    const onVnodeBeforeUpdate = jest.fn()
    const onVnodeUpdated = jest.fn()
    const onVnodeBeforeUnmount = jest.fn()
    const onVnodeUnmounted = jest.fn()
    const root = nodeOps.createElement('div')
    const count = ref(0)

    const App = () =>
      h('div', {
        onVnodeBeforeMount,
        onVnodeMounted,
        onVnodeBeforeUpdate,
        onVnodeUpdated,
        onVnodeBeforeUnmount,
        onVnodeUnmounted,
        count: count.value
      })

    render(h(App), root)
    await nextTick()
    expect(onVnodeBeforeMount).toBeCalled()
    expect(onVnodeMounted).toBeCalled()

    count.value++
    await nextTick()
    expect(onVnodeBeforeUpdate).toBeCalled()
    expect(onVnodeUpdated).toBeCalled()

    render(null, root)
    await nextTick()
    expect(onVnodeBeforeUnmount).toBeCalled()
    expect(onVnodeUnmounted).toBeCalled()
  })

  test('component', async () => {
    const Comp = () => h('div')
    const onVnodeBeforeMount = jest.fn()
    const onVnodeMounted = jest.fn()
    const onVnodeBeforeUpdate = jest.fn()
    const onVnodeUpdated = jest.fn()
    const onVnodeBeforeUnmount = jest.fn()
    const onVnodeUnmounted = jest.fn()
    const root = nodeOps.createElement('div')
    const count = ref(0)

    const App = () =>
      h(Comp, {
        onVnodeBeforeMount,
        onVnodeMounted,
        onVnodeBeforeUpdate,
        onVnodeUpdated,
        onVnodeBeforeUnmount,
        onVnodeUnmounted,
        count: count.value
      })

    render(h(App), root)
    await nextTick()
    expect(onVnodeBeforeMount).toBeCalled()
    expect(onVnodeMounted).toBeCalled()

    count.value++
    await nextTick()
    expect(onVnodeBeforeUpdate).toBeCalled()
    expect(onVnodeUpdated).toBeCalled()

    render(null, root)
    await nextTick()
    expect(onVnodeBeforeUnmount).toBeCalled()
    expect(onVnodeUnmounted).toBeCalled()
  })
})
