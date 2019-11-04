import {
  nodeOps,
  serializeInner,
  render,
  h,
  createComponent,
  Portal,
  Text,
  Fragment,
  ref,
  nextTick,
  TestElement,
  TestNode
} from '@vue/runtime-test'
import { VNodeChildren } from '../src/vnode'

describe('renderer: portal', () => {
  test('should work', () => {
    const target = nodeOps.createElement('div')
    const root = nodeOps.createElement('div')

    const Comp = createComponent(() => () =>
      h(Fragment, [
        h(Portal, { target }, h('div', 'teleported')),
        h('div', 'root')
      ])
    )
    render(h(Comp), root)

    expect(serializeInner(root)).toMatchSnapshot()
    expect(serializeInner(target)).toMatchSnapshot()
  })

  test('should update target', async () => {
    const targetA = nodeOps.createElement('div')
    const targetB = nodeOps.createElement('div')
    const target = ref(targetA)
    const root = nodeOps.createElement('div')

    const Comp = createComponent(() => () =>
      h(Fragment, [
        h(Portal, { target: target.value }, h('div', 'teleported')),
        h('div', 'root')
      ])
    )
    render(h(Comp), root)

    expect(serializeInner(root)).toMatchSnapshot()
    expect(serializeInner(targetA)).toMatchSnapshot()
    expect(serializeInner(targetB)).toMatchSnapshot()

    target.value = targetB
    await nextTick()

    expect(serializeInner(root)).toMatchSnapshot()
    expect(serializeInner(targetA)).toMatchSnapshot()
    expect(serializeInner(targetB)).toMatchSnapshot()
  })

  test('should update children', async () => {
    const target = nodeOps.createElement('div')
    const root = nodeOps.createElement('div')
    const children = ref<VNodeChildren<TestNode, TestElement>>([
      h('div', 'teleported')
    ])

    const Comp = createComponent(() => () =>
      h(Portal, { target }, children.value)
    )
    render(h(Comp), root)

    expect(serializeInner(target)).toMatchSnapshot()

    children.value = []
    await nextTick()

    expect(serializeInner(target)).toMatchSnapshot()

    children.value = [h(Text, 'teleported')]
    await nextTick()

    expect(serializeInner(target)).toMatchSnapshot()
  })
})
