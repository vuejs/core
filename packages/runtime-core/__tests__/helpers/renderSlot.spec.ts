import { renderSlot } from '../../src/helpers/renderSlot'
import {
  h,
  withCtx,
  createVNode,
  openBlock,
  createBlock,
  Fragment
} from '../../src'
import { PatchFlags } from '@vue/shared/src'

describe('renderSlot', () => {
  it('should render slot', () => {
    let child
    const vnode = renderSlot(
      { default: () => [(child = h('child'))] },
      'default'
    )
    expect(vnode.children).toEqual([child])
  })

  it('should render slot fallback', () => {
    const vnode = renderSlot({}, 'default', {}, () => ['fallback'])
    expect(vnode.children).toEqual(['fallback'])
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
      {} as any
    )

    // manual invocation should not track
    const manual = (openBlock(), createBlock(Fragment, null, slot()))
    expect(manual.dynamicChildren!.length).toBe(0)

    // renderSlot should track
    const templateRendered = renderSlot({ default: slot }, 'default')
    expect(templateRendered.dynamicChildren!.length).toBe(1)
  })
})
