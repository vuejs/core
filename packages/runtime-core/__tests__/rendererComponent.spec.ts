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

  it('should create an Component with props', () => {
    const Comp = {
      render: () => {
        return h('div')
      }
    }
    const root = nodeOps.createElement('div')
    render(h(Comp, { id: 'foo', class: 'bar' }), root)
    expect(serializeInner(root)).toBe(`<div id="foo" class="bar"></div>`)
  })

  it('should create an Component with direct text children', () => {
    const Comp = {
      render: () => {
        return h('div', 'test')
      }
    }
    const root = nodeOps.createElement('div')
    render(h(Comp, { id: 'foo', class: 'bar' }), root)
    expect(serializeInner(root)).toBe(`<div id="foo" class="bar">test</div>`)
  })

  it('should update an Component tag which is already mounted', () => {
    const Comp1 = {
      render: () => {
        return h('div', 'foo')
      }
    }
    const root = nodeOps.createElement('div')
    render(h(Comp1), root)
    expect(serializeInner(root)).toBe('<div>foo</div>')

    const Comp2 = {
      render: () => {
        return h('span', 'foo')
      }
    }
    render(h(Comp2), root)
    expect(serializeInner(root)).toBe('<span>foo</span>')
  })
})
