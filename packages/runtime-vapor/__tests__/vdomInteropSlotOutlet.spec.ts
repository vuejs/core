import {
  Fragment,
  type Slot,
  type VNode,
  createApp,
  createBlock,
  createCommentVNode,
  h,
  openBlock,
  rawVaporSlotKey,
  renderSlot,
  setCurrentRenderingInstance,
  withCtx,
} from '@vue/runtime-dom'
import { PatchFlags, ShapeFlags } from '@vue/shared'
import { vaporInteropPlugin } from '../src'

// Hand-built vnodes: these observe the records the walk leaves on the slot
// vnodes of an outlet. The compiled scenarios are in vdomInterop.spec.ts.
describe('vdom interop: vapor slot outlets', () => {
  const vaporSlot = () => []
  ;(vaporSlot as any)[rawVaporSlotKey] = vaporSlot
  const forward = (fallback?: () => any[]) =>
    renderSlot({ default: vaporSlot }, 'default', {}, fallback)
  const appContext = createApp({}).use(vaporInteropPlugin)._context

  beforeEach(() => {
    setCurrentRenderingInstance({ type: {}, vnode: {}, appContext } as any)
  })

  afterEach(() => {
    setCurrentRenderingInstance(null)
  })

  it('records each outlet fallback with its owner, innermost first', () => {
    const wrapper = { type: {}, vnode: {}, appContext } as any
    const inner = { type: {}, vnode: {}, appContext } as any
    const wrapperFallback = () => [h('b')]
    const innerFallback = () => [h('p')]
    let forwarded!: VNode

    setCurrentRenderingInstance(inner)
    // the compiled wrapper forwards its outlet inside a `withCtx` slot, so
    // the inner outlet invokes it under the wrapper's rendering instance
    const rendered = renderSlot(
      {
        default: withCtx(
          () => [(forwarded = forward(wrapperFallback))],
          wrapper,
        ) as Slot,
      },
      'default',
      {},
      innerFallback,
    )

    expect((rendered.children as VNode[])[0]).toBe(forwarded)
    const [own, enclosing] = forwarded.vs!.outlets!
    expect(own.fallback).toBe(wrapperFallback)
    expect(own.owner).toBe(wrapper)
    expect(own.innerIds).toBeUndefined()
    expect(enclosing.fallback).toBe(innerFallback)
    expect(enclosing.owner).toBe(inner)
    expect(enclosing.innerIds).toBe(0)
  })

  it('finds the sole vapor slot through single-child fragments', () => {
    let forwarded!: VNode
    const fallback = () => [h('p')]
    renderSlot(
      {
        default: () => [
          (openBlock(),
          createBlock(Fragment, { key: 0 }, [(forwarded = forward())])),
        ],
      },
      'default',
      {},
      fallback,
    )
    expect(forwarded.vs!.outlets!.map(o => o.fallback)).toEqual([fallback])
  })

  it('counts the slot scope ids of the fragments inside each outlet', () => {
    // scoped outlets: the inner outlet fragment carries a slotted id, which
    // the outer outlet's fallback must not render under
    setCurrentRenderingInstance({
      type: { __scopeId: 'scope' },
      appContext,
    } as any)
    let forwarded!: VNode
    renderSlot(
      {
        default: () => [
          renderSlot(
            { default: () => [(forwarded = forward())] },
            'default',
            {},
            () => [h('p')],
          ),
        ],
      },
      'default',
      {},
      () => [h('b')],
    )
    expect(forwarded.vs!.outlets!.map(o => o.innerIds)).toEqual([0, 1])
  })

  it('records an outlet once on a slot vnode reused across renders', () => {
    // `<slot v-once/>`: the same vnode comes back on every render of the
    // outlets around it
    const cached = forward()
    const inner = { type: {}, vnode: {}, appContext } as any
    const outer = { type: {}, vnode: {}, appContext } as any
    const render = () => {
      setCurrentRenderingInstance(outer)
      return renderSlot(
        {
          default: withCtx(
            () => [renderSlot({ default: () => [cached] }, 'default', {}, fb)],
            inner,
          ) as Slot,
        },
        'default',
        {},
        fb,
      )
    }
    const fb = () => [h('p')]
    render()
    const first = cached.vs!.outlets!
    expect(first.map(o => o.owner)).toEqual([inner, outer])
    render()
    expect(cached.vs!.outlets!.map(o => o.owner)).toEqual([inner, outer])
    // what an earlier render handed to the renderer stays as it was
    expect(first.map(o => o.owner)).toEqual([inner, outer])
    expect(cached.vs!.outlets).not.toBe(first)
  })

  it('stacks enclosing outlets innermost first', () => {
    let forwarded!: VNode
    const innerFallback = () => [h('p')]
    const outerFallback = () => [h('b')]
    renderSlot(
      {
        default: () => [
          renderSlot(
            { default: () => [(forwarded = forward())] },
            'default',
            {},
            innerFallback,
          ),
        ],
      },
      'default',
      {},
      outerFallback,
    )
    expect(forwarded.vs!.outlets!.map(o => o.fallback)).toEqual([
      innerFallback,
      outerFallback,
    ])
  })

  it('appends a fallback host when the content can hold several vapor slots', () => {
    const fallback = () => [h('p')]
    const contents: [content: () => VNode[], slots: number][] = [
      [() => [forward(), forward()], 2],
      // a `v-if` slot leaves its comment behind
      [() => [forward(), createCommentVNode('v-if')], 1],
      // a list of one
      [
        () => [
          (openBlock(true),
          createBlock(Fragment, null, [forward()], PatchFlags.KEYED_FRAGMENT)),
        ],
        1,
      ],
    ]
    for (const [content, slots] of contents) {
      const rendered = renderSlot({ default: content }, 'default', {}, fallback)
      const children = rendered.children as VNode[]
      const host = children[children.length - 1]
      expect(host.vs!.outlets!.map(o => o.fallback)).toEqual([fallback])
      expect(host.vs!.members!.length).toBe(slots)
      for (const member of host.vs!.members!) {
        expect(member.vs!.outlets).toBeUndefined()
      }
      expect(rendered.patchFlag).toBe(PatchFlags.BAIL)
    }
  })

  it.each([
    [
      'a v-for over no item',
      () => [
        (openBlock(true),
        createBlock(Fragment, null, [], PatchFlags.KEYED_FRAGMENT)),
      ],
    ],
    ['a closed v-if branch', () => [createCommentVNode('v-if', true)]],
  ])(
    'hosts the fallback of an outlet left without slots only when vapor slots are forwarded to it: %s',
    (_, content) => {
      const fallback = () => [h('p')]
      const owner = (forwardsVapor: boolean) =>
        ({
          type: {},
          appContext,
          vnode: {
            shapeFlag: ShapeFlags.SLOTS_CHILDREN,
            children: { [rawVaporSlotKey]: forwardsVapor },
          },
        }) as any

      setCurrentRenderingInstance(owner(true))
      let rendered = renderSlot({ default: content }, 'default', {}, fallback)
      let children = rendered.children as VNode[]
      expect(children.length).toBe(2)
      expect(children[1].vs!.members).toEqual([])
      expect(children[1].vs!.outlets!.map(o => o.fallback)).toEqual([fallback])
      // a host is its outlet's own vnode
      expect(children[1].vs!.outlets![0].innerIds).toBeUndefined()
      // the same fragment as when slots are there
      expect(rendered.key).toBe('_default')
      expect(
        renderSlot(
          { default: () => [forward(), forward()] },
          'default',
          {},
          fallback,
        ).key,
      ).toBe('_default')

      // plain vdom: the fallback renders inline
      setCurrentRenderingInstance(owner(false))
      rendered = renderSlot({ default: content }, 'default', {}, fallback)
      children = rendered.children as VNode[]
      expect(children.map(c => c.type)).toEqual(['p'])
      expect(rendered.key).toBe('_default_fb')
    },
  )

  it('leaves the outlet alone when its content stands on its own', () => {
    const fallback = () => [h('p')]
    // valid vdom content beside the slot
    const rendered = renderSlot(
      { default: () => [forward(), h('span')] },
      'default',
      {},
      fallback,
    )
    for (const child of rendered.children as VNode[]) {
      if (child.vs) expect(child.vs.outlets).toBeUndefined()
    }
    // no fallback to record
    let forwarded!: VNode
    renderSlot({ default: () => [(forwarded = forward())] }, 'default', {})
    expect(forwarded.vs!.outlets).toBeUndefined()
  })
})
