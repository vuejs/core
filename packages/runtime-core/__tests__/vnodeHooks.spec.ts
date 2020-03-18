import {
  h,
  render,
  nodeOps,
  VNodeProps,
  TestElement,
  NodeTypes,
  VNode
} from '@vue/runtime-test'

describe('renderer: vnode hooks', () => {
  function assertHooks(hooks: VNodeProps, vnode1: VNode, vnode2: VNode) {
    const root = nodeOps.createElement('div')
    render(vnode1, root)
    expect(hooks.onVnodeBeforeMount).toHaveBeenCalledWith(vnode1, null)
    expect(hooks.onVnodeMounted).toHaveBeenCalledWith(vnode1, null)
    expect(hooks.onVnodeBeforeUpdate).not.toHaveBeenCalled()
    expect(hooks.onVnodeUpdated).not.toHaveBeenCalled()
    expect(hooks.onVnodeBeforeUnmount).not.toHaveBeenCalled()
    expect(hooks.onVnodeUnmounted).not.toHaveBeenCalled()

    // update
    render(vnode2, root)
    expect(hooks.onVnodeBeforeMount).toHaveBeenCalledTimes(1)
    expect(hooks.onVnodeMounted).toHaveBeenCalledTimes(1)
    expect(hooks.onVnodeBeforeUpdate).toHaveBeenCalledWith(vnode2, vnode1)
    expect(hooks.onVnodeUpdated).toHaveBeenCalledWith(vnode2, vnode1)
    expect(hooks.onVnodeBeforeUnmount).not.toHaveBeenCalled()
    expect(hooks.onVnodeUnmounted).not.toHaveBeenCalled()

    // unmount
    render(null, root)
    expect(hooks.onVnodeBeforeMount).toHaveBeenCalledTimes(1)
    expect(hooks.onVnodeMounted).toHaveBeenCalledTimes(1)
    expect(hooks.onVnodeBeforeUpdate).toHaveBeenCalledTimes(1)
    expect(hooks.onVnodeUpdated).toHaveBeenCalledTimes(1)
    expect(hooks.onVnodeBeforeUnmount).toHaveBeenCalledWith(vnode2, null)
    expect(hooks.onVnodeUnmounted).toHaveBeenCalledWith(vnode2, null)
  }

  test('should work on element', () => {
    const hooks: VNodeProps = {
      onVnodeBeforeMount: jest.fn(),
      onVnodeMounted: jest.fn(),
      onVnodeBeforeUpdate: jest.fn(vnode => {
        expect((vnode.el as TestElement).children[0]).toMatchObject({
          type: NodeTypes.TEXT,
          text: 'foo'
        })
      }),
      onVnodeUpdated: jest.fn(vnode => {
        expect((vnode.el as TestElement).children[0]).toMatchObject({
          type: NodeTypes.TEXT,
          text: 'bar'
        })
      }),
      onVnodeBeforeUnmount: jest.fn(),
      onVnodeUnmounted: jest.fn()
    }

    assertHooks(hooks, h('div', hooks, 'foo'), h('div', hooks, 'bar'))
  })

  test('should work on component', () => {
    const Comp = (props: { msg: string }) => props.msg

    const hooks: VNodeProps = {
      onVnodeBeforeMount: jest.fn(),
      onVnodeMounted: jest.fn(),
      onVnodeBeforeUpdate: jest.fn(vnode => {
        expect(vnode.el as TestElement).toMatchObject({
          type: NodeTypes.TEXT,
          text: 'foo'
        })
      }),
      onVnodeUpdated: jest.fn(vnode => {
        expect(vnode.el as TestElement).toMatchObject({
          type: NodeTypes.TEXT,
          text: 'bar'
        })
      }),
      onVnodeBeforeUnmount: jest.fn(),
      onVnodeUnmounted: jest.fn()
    }

    assertHooks(
      hooks,
      h(Comp, {
        ...hooks,
        msg: 'foo'
      }),
      h(Comp, {
        ...hooks,
        msg: 'bar'
      })
    )
  })
})
