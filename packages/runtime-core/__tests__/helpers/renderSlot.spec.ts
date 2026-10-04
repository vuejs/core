import {
  invokeSlotFallback,
  rawVaporSlotKey,
  renderSlot,
} from '../../src/helpers/renderSlot'
import {
  Fragment,
  type Slot,
  type VNode,
  createBlock,
  createCommentVNode,
  createVNode,
  h,
  openBlock,
  withCtx,
} from '../../src'
import { PatchFlags } from '@vue/shared'
import {
  currentRenderingInstance,
  setCurrentRenderingInstance,
} from '../../src/componentRenderContext'
import { blockStack } from '../../src/vnode'

describe('renderSlot', () => {
  beforeEach(() => {
    setCurrentRenderingInstance({ type: {} } as any)
  })

  afterEach(() => {
    setCurrentRenderingInstance(null)
  })

  it('should render slot', () => {
    let child
    const vnode = renderSlot(
      { default: () => [(child = h('child'))] },
      'default',
      { key: 'foo' },
    )
    expect(vnode.children).toEqual([child])
    expect(vnode.key).toBe('foo')
  })

  it('should allow symbol values for slot prop key', () => {
    const key = Symbol()
    const vnode = renderSlot({ default: () => [h('div')] }, 'default', { key })
    expect(vnode.key).toBe('_default')
  })

  it('should allow symbol values for compiler-injected slot keys', () => {
    const key = Symbol()
    const vnode = renderSlot(
      { default: () => [h('div')] },
      'default',
      {},
      undefined,
      undefined,
      key,
    )
    expect(vnode.key).toBe('_default')
  })

  it('should not expose compiler-injected slot keys to slot props', () => {
    let receivedProps: any
    const props = ['foo', 'bar']
    const vnode = renderSlot(
      {
        default: props => {
          receivedProps = props
          return [h('div')]
        },
      },
      'default',
      props as any,
      undefined,
      undefined,
      'branch',
    )

    expect(receivedProps).toBe(props)
    expect(receivedProps).not.toHaveProperty('key')
    expect(vnode.key).toBe('branch')
  })

  it('should prefer user-provided slot prop keys over compiler-injected keys', () => {
    let receivedProps: any
    const props = { key: 'user' }
    const vnode = renderSlot(
      {
        default: props => {
          receivedProps = props
          return [h('div')]
        },
      },
      'default',
      props,
      undefined,
      undefined,
      'branch',
    )

    expect(receivedProps).toBe(props)
    expect(vnode.key).toBe('user')
  })

  it('should preserve compiler-injected slot keys in custom element mode', () => {
    setCurrentRenderingInstance({ type: {}, ce: {} } as any)

    let vnode = renderSlot({}, 'default', {}, undefined, undefined, 0)
    let slot = (vnode.children as any[])[0]
    expect(slot.type).toBe('slot')
    expect(slot.key).toBe(0)
    expect(vnode.patchFlag).toBe(PatchFlags.BAIL)

    vnode = renderSlot(
      {},
      'default',
      { key: 'user' },
      undefined,
      undefined,
      'branch',
    )
    slot = (vnode.children as any[])[0]
    expect(slot.key).toBe('user')
  })

  it('should handle nullish props', () => {
    for (const props of [null, undefined]) {
      let receivedProps: any
      const vnode = renderSlot(
        {
          default: props => {
            receivedProps = props
            return [h('div')]
          },
        },
        'default',
        props,
      )
      expect(receivedProps).toEqual({})
      expect(vnode.key).toBe('_default')
    }
  })

  it('should handle nullish props with a compiler-injected slot key', () => {
    for (const props of [null, undefined]) {
      const vnode = renderSlot(
        { default: () => [h('div')] },
        'default',
        props,
        undefined,
        undefined,
        'branch',
      )
      expect(vnode.key).toBe('branch')
    }
  })

  it('should handle nullish props in custom element mode', () => {
    setCurrentRenderingInstance({ type: {}, ce: {} } as any)

    for (const props of [null, undefined]) {
      const vnode = renderSlot({}, 'foo', props, undefined, undefined, 'branch')
      const slot = (vnode.children as any[])[0]
      expect(slot.type).toBe('slot')
      expect(slot.key).toBe('branch')
      expect(slot.props.name).toBe('foo')
    }
  })

  it('should render slot fallback', () => {
    const vnode = renderSlot({}, 'default', { key: 'foo' }, () => ['fallback'])
    expect(vnode.children).toEqual(['fallback'])
    // should attach fallback key postfix
    expect(vnode.key).toBe('foo_fb')
  })

  it('should warn render ssr slot', () => {
    renderSlot({ default: (_a, _b, _c) => [h('child')] }, 'default')
    expect('SSR-optimized slot function detected').toHaveBeenWarned()
  })

  // #1745
  it('should force enable tracking', () => {
    const slot = withCtx(
      () => {
        return [createVNode('div', null, 'foo', PatchFlags.TEXT)]
      },
      // mock instance
      { type: {}, appContext: {} } as any,
    ) as Slot

    // manual invocation should not track
    const manual = (openBlock(), createBlock(Fragment, null, slot()))
    expect(manual.dynamicChildren!.length).toBe(0)

    // renderSlot should track
    const templateRendered = renderSlot({ default: slot }, 'default')
    expect(templateRendered.dynamicChildren!.length).toBe(1)
  })

  // #2347 #2461
  describe('only render valid slot content', () => {
    it('should ignore slots that are all comments', () => {
      let fallback
      const vnode = renderSlot(
        { default: () => [createCommentVNode('foo')] },
        'default',
        undefined,
        () => [(fallback = h('fallback'))],
      )
      expect(vnode.children).toEqual([fallback])
      expect(vnode.patchFlag).toBe(PatchFlags.BAIL)
    })

    it('should ignore invalid slot content generated by nested slot', () => {
      let fallback
      const vnode = renderSlot(
        { default: () => [renderSlot({}, 'foo')] },
        'default',
        undefined,
        () => [(fallback = h('fallback'))],
      )
      expect(vnode.children).toEqual([fallback])
      expect(vnode.patchFlag).toBe(PatchFlags.BAIL)
    })
  })

  describe('vapor slot outlets', () => {
    const vaporSlot = () => []
    ;(vaporSlot as any)[rawVaporSlotKey] = vaporSlot
    const forward = (fallback?: () => any[]) =>
      renderSlot({ default: vaporSlot }, 'default', {}, fallback)

    it('records the fallback of the outlet rendering a vapor slot', () => {
      const owner = { type: {}, appContext: {} } as any
      setCurrentRenderingInstance(owner)
      const fallback = () => [h('p')]
      expect(forward(fallback).vs!.outlets).toEqual([{ fallback, owner }])
      expect(forward().vs!.outlets).toBeUndefined()
    })

    it('leaves the content of an outlet alone in an app without the interop', () => {
      // observes the gate only: no vapor slot gets there without the interop
      setCurrentRenderingInstance({ type: {}, appContext: {} } as any)
      let forwarded!: VNode
      renderSlot(
        { default: () => [(forwarded = forward())] },
        'default',
        {},
        () => [h('p')],
      )
      expect(forwarded.vs!.outlets).toBeUndefined()
    })

    it('hands the content of an outlet with a fallback over to the interop', () => {
      const attachSlotOutlet = vi.fn()
      const owner = { type: {}, appContext: { vapor: { attachSlotOutlet } } }
      setCurrentRenderingInstance(owner as any)
      const fallback = () => [h('p')]
      const content = [forward()]

      // no fallback to hand over
      renderSlot({ default: () => content }, 'default', {})
      // nor content: the fallback renders inline
      renderSlot(
        { default: () => [createCommentVNode('v-if', true)] },
        'default',
        {},
        fallback,
      )
      expect(attachSlotOutlet).not.toHaveBeenCalled()

      renderSlot({ default: () => content }, 'default', {}, fallback)
      expect(attachSlotOutlet).toHaveBeenCalledWith(content, fallback, owner)
    })

    it('marks the fragment of an outlet whose fallback the interop took over', () => {
      const attachSlotOutlet = vi.fn(() => false)
      setCurrentRenderingInstance({
        type: {},
        appContext: { vapor: { attachSlotOutlet } },
      } as any)
      const render = () =>
        renderSlot({ default: () => [forward()] }, 'default', {}, () => [
          h('p'),
        ])
      expect(render().vo).toBeUndefined()
      attachSlotOutlet.mockReturnValue(true)
      expect(render().vo).toBe(true)
    })
  })

  describe('invokeSlotFallback', () => {
    it('renders the fallback under its owner and restores the previous instance', () => {
      const owner = { type: { __scopeId: 'owner' } } as any
      const outer = { type: {} } as any
      setCurrentRenderingInstance(outer)
      const children = invokeSlotFallback(() => [h('p')], owner)
      expect((children[0] as VNode).scopeId).toBe('owner')
      expect(currentRenderingInstance).toBe(outer)
    })

    it('closes blocks left open by a throwing fallback', () => {
      const owner = { type: {} } as any
      const size = blockStack.length
      expect(() =>
        invokeSlotFallback(() => {
          openBlock()
          throw new Error('boom')
        }, owner),
      ).toThrow('boom')
      expect(blockStack.length).toBe(size)
    })
  })
})
