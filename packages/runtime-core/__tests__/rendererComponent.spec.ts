import {
  ref,
  h,
  render,
  nodeOps,
  serializeInner,
  nextTick,
  VNode
} from '@vue/runtime-test'

describe('renderer: component', () => {
  test('should update parent(hoc) component host el when child component self update', async () => {
    const value = ref(true)
    let parentVnode: VNode
    let childVnode1: VNode
    let childVnode2: VNode

    const Parent = {
      render: () => {
        // let Parent first rerender
        return (parentVnode = h(Child))
      }
    }

    const Child = {
      render: () => {
        return value.value
          ? (childVnode1 = h('div'))
          : (childVnode2 = h('span'))
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Parent), root)
    expect(serializeInner(root)).toBe(`<div></div>`)
    expect(parentVnode!.el).toBe(childVnode1!.el)

    value.value = false
    await nextTick()
    expect(serializeInner(root)).toBe(`<span></span>`)
    expect(parentVnode!.el).toBe(childVnode2!.el)
  })
})
