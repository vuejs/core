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

  it('should preserve local fallback while updating outlet fallback on forwarded vapor slot', () => {
    const localFallback = () => [createCommentVNode('local empty')]
    const firstOuterFallback = () => ['first outer fallback']
    const nextOuterFallback = () => ['next outer fallback']
    const forwarded = createVNode('div')

    forwarded.vs = {
      slot: () => [],
      fallback: localFallback,
    } as any

    renderSlot(
      {
        default: () => [forwarded],
      },
      'default',
      undefined,
      firstOuterFallback,
    )

    expect(forwarded.vs!.fallback).toBe(localFallback)
    expect(forwarded.vs!.outletFallback).toBe(firstOuterFallback)

    renderSlot(
      {
        default: () => [forwarded],
      },
      'default',
      undefined,
      nextOuterFallback,
    )

    expect(forwarded.vs!.fallback).toBe(localFallback)
    expect(forwarded.vs!.outletFallback).toBe(nextOuterFallback)
  })

  it('records the rendering instance that owns each fallback on a forwarded vapor slot', () => {
    const vaporSlot = () => []
    ;(vaporSlot as any)[rawVaporSlotKey] = vaporSlot
    const wrapper = { type: {}, appContext: {} } as any
    const inner = { type: {}, appContext: {} } as any
    const wrapperFallback = () => [h('b')]
    const innerFallback = () => [h('p')]
    let forwarded!: VNode

    setCurrentRenderingInstance(inner)
    // the compiled wrapper forwards its outlet inside a `withCtx` slot, so
    // the inner outlet invokes it under the wrapper's rendering instance
    const rendered = renderSlot(
      {
        default: withCtx(
          () => [
            (forwarded = renderSlot(
              { default: vaporSlot },
              'default',
              {},
              wrapperFallback,
            )),
          ],
          wrapper,
        ) as Slot,
      },
      'default',
      {},
      innerFallback,
    )

    expect((rendered.children as VNode[])[0]).toBe(forwarded)
    expect(forwarded.vs!.fallback).toBe(wrapperFallback)
    expect(forwarded.vs!.owner).toBe(wrapper)
    expect(forwarded.vs!.outletFallback).toBe(innerFallback)
    expect(forwarded.vs!.outletOwner).toBe(inner)
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
