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
import { PatchFlags } from '@vue/shared'
import { vaporInteropPlugin } from '../src'

// Hand-built vnodes: these observe the records the interop leaves on the slot
// vnode of a vdom outlet. The compiled scenarios are in vdomInterop.spec.ts.
describe('vdom interop: vapor slot outlets', () => {
  const vaporSlot = () => []
  ;(vaporSlot as any)[rawVaporSlotKey] = vaporSlot
  const forward = (fallback?: () => any[]) =>
    renderSlot({ default: vaporSlot }, 'default', {}, fallback)
  const appContext = createApp({}).use(vaporInteropPlugin)._context
  const instance = () => ({ type: {}, appContext }) as any

  beforeEach(() => {
    setCurrentRenderingInstance(instance())
  })

  afterEach(() => {
    setCurrentRenderingInstance(null)
  })

  it('records each outlet fallback with its owner, innermost first', () => {
    const wrapper = instance()
    const inner = instance()
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
    expect(enclosing.fallback).toBe(innerFallback)
    expect(enclosing.owner).toBe(inner)
  })

  it('finds the slot through the fragment of an outlet inside and past comments', () => {
    let forwarded!: VNode
    const innerFallback = () => [h('p')]
    const outerFallback = () => [h('b')]
    renderSlot(
      {
        default: () => [
          createCommentVNode('note'),
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

  it('leaves the outlet alone unless its content is that one slot', () => {
    const fallback = () => [h('p')]
    const cases: (() => VNode[])[] = [
      // valid vdom content beside the slot
      () => [forward(), h('span')],
      // a second vapor slot
      () => [forward(), forward()],
      // a list, whatever it holds right now
      () => [
        (openBlock(true),
        createBlock(Fragment, null, [forward()], PatchFlags.KEYED_FRAGMENT)),
      ],
    ]
    const slots = (vnodes: VNode[]): VNode[] =>
      vnodes.flatMap(vnode =>
        vnode.vs ? [vnode] : slots((vnode.children as VNode[]) || []),
      )
    for (const content of cases) {
      const rendered = renderSlot({ default: content }, 'default', {}, fallback)
      const found = slots(rendered.children as VNode[])
      expect(found.length).toBeGreaterThan(0)
      for (const slot of found) expect(slot.vs!.outlets).toBeUndefined()
    }
  })

  it('records on a clone of a slot vnode its owner keeps', () => {
    // `<slot v-once/>`: the same vnode comes back on every render, and to
    // every outlet of one render
    const cached = forward()
    cached.cacheIndex = 0
    const a = () => [h('p', 'A')]
    const b = () => [h('p', 'B')]
    for (let i = 0; i < 2; i++) {
      const [inA] = renderSlot({ default: () => [cached] }, 'default', {}, a)
        .children as VNode[]
      const [inB] = renderSlot({ default: () => [cached] }, 'default', {}, b)
        .children as VNode[]
      expect(inA.vs!.outlets!.map(o => o.fallback)).toEqual([a])
      expect(inB.vs!.outlets!.map(o => o.fallback)).toEqual([b])
      // an outlet with no fallback renders the vnode untouched
      expect(cached.vs!.outlets).toBeUndefined()
    }
  })

  it('never writes the records of a slot vnode in place', () => {
    // its clones share them
    const forwarded = forward(() => [])
    const own = forwarded.vs!.outlets!
    renderSlot({ default: () => [forwarded] }, 'default', {}, () => [h('p')])
    expect(forwarded.vs!.outlets!.length).toBe(2)
    expect(own.length).toBe(1)
  })
})
