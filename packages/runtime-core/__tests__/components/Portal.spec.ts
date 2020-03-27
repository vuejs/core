import {
  nodeOps,
  serializeInner,
  render,
  h,
  Portal,
  Text,
  ref,
  nextTick
} from '@vue/runtime-test'
import { createVNode } from '../../src/vnode'

describe('renderer: portal', () => {
  test('should work', () => {
    const target = nodeOps.createElement('div')
    const root = nodeOps.createElement('div')

    render(
      h(() => [
        h(Portal, { target }, h('div', 'teleported')),
        h('div', 'root')
      ]),
      root
    )

    expect(serializeInner(root)).toMatchInlineSnapshot(
      `"<!--portal--><div>root</div>"`
    )
    expect(serializeInner(target)).toMatchInlineSnapshot(
      `"<div>teleported</div>"`
    )
  })

  test('should update target', async () => {
    const targetA = nodeOps.createElement('div')
    const targetB = nodeOps.createElement('div')
    const target = ref(targetA)
    const root = nodeOps.createElement('div')

    render(
      h(() => [
        h(Portal, { target: target.value }, h('div', 'teleported')),
        h('div', 'root')
      ]),
      root
    )

    expect(serializeInner(root)).toMatchInlineSnapshot(
      `"<!--portal--><div>root</div>"`
    )
    expect(serializeInner(targetA)).toMatchInlineSnapshot(
      `"<div>teleported</div>"`
    )
    expect(serializeInner(targetB)).toMatchInlineSnapshot(`""`)

    target.value = targetB
    await nextTick()

    expect(serializeInner(root)).toMatchInlineSnapshot(
      `"<!--portal--><div>root</div>"`
    )
    expect(serializeInner(targetA)).toMatchInlineSnapshot(`""`)
    expect(serializeInner(targetB)).toMatchInlineSnapshot(
      `"<div>teleported</div>"`
    )
  })

  test('should update children', async () => {
    const target = nodeOps.createElement('div')
    const root = nodeOps.createElement('div')
    const children = ref([h('div', 'teleported')])

    render(h(Portal, { target }, children.value), root)
    expect(serializeInner(target)).toMatchInlineSnapshot(
      `"<div>teleported</div>"`
    )

    children.value = []
    await nextTick()

    expect(serializeInner(target)).toMatchInlineSnapshot(
      `"<div>teleported</div>"`
    )

    children.value = [createVNode(Text, null, 'teleported')]
    await nextTick()

    expect(serializeInner(target)).toMatchInlineSnapshot(
      `"<div>teleported</div>"`
    )
  })

  test('should remove children when unmounted', () => {
    const target = nodeOps.createElement('div')
    const root = nodeOps.createElement('div')

    render(
      h(() => [
        h(Portal, { target }, h('div', 'teleported')),
        h('div', 'root')
      ]),
      root
    )
    expect(serializeInner(target)).toMatchInlineSnapshot(
      `"<div>teleported</div>"`
    )

    render(null, root)
    expect(serializeInner(target)).toBe('')
  })

  test('multiple portal with same target', () => {
    const target = nodeOps.createElement('div')
    const root = nodeOps.createElement('div')

    render(
      h('div', [
        h(Portal, { target }, h('div', 'one')),
        h(Portal, { target }, 'two')
      ]),
      root
    )

    expect(serializeInner(root)).toMatchInlineSnapshot(
      `"<div><!--portal--><!--portal--></div>"`
    )
    expect(serializeInner(target)).toMatchInlineSnapshot(`"<div>one</div>two"`)

    // update existing content
    render(
      h('div', [
        h(Portal, { target }, [h('div', 'one'), h('div', 'two')]),
        h(Portal, { target }, 'three')
      ]),
      root
    )
    expect(serializeInner(target)).toMatchInlineSnapshot(
      `"<div>one</div><div>two</div>three"`
    )

    // toggling
    render(h('div', [null, h(Portal, { target }, 'three')]), root)
    expect(serializeInner(root)).toMatchInlineSnapshot(
      `"<div><!----><!--portal--></div>"`
    )
    expect(serializeInner(target)).toMatchInlineSnapshot(`"three"`)

    // toggle back
    render(
      h('div', [
        h(Portal, { target }, [h('div', 'one'), h('div', 'two')]),
        h(Portal, { target }, 'three')
      ]),
      root
    )
    expect(serializeInner(root)).toMatchInlineSnapshot(
      `"<div><!--portal--><!--portal--></div>"`
    )
    // should append
    expect(serializeInner(target)).toMatchInlineSnapshot(
      `"three<div>one</div><div>two</div>"`
    )

    // toggle the other portal
    render(
      h('div', [
        h(Portal, { target }, [h('div', 'one'), h('div', 'two')]),
        null
      ]),
      root
    )
    expect(serializeInner(root)).toMatchInlineSnapshot(
      `"<div><!--portal--><!----></div>"`
    )
    expect(serializeInner(target)).toMatchInlineSnapshot(
      `"<div>one</div><div>two</div>"`
    )
  })
})
