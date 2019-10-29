import {
  mockWarn,
  h,
  Portal,
  render,
  nodeOps,
  serializeInner,
  nextTick,
  ref
} from '@vue/runtime-test'

describe('renderer: portal', () => {
  mockWarn()

  test('portals require a target', async () => {
    const Parent = () => h(Portal, [h(Child)])

    const Child = () => h('div', 'child')

    const Comp = () => [h(Parent), h('div', { id: 'target' })]

    const root = nodeOps.createElement('div')
    render(h(Comp), root)

    expect('Invalid Portal target on mount:').toHaveBeenWarned()
  })

  test('portals can render to host nodes', async () => {
    const portalRoot = nodeOps.createElement('div')

    const PortalContent = () => h('div', 'portal content')
    const Comp = () => h(Portal, { target: portalRoot }, [h(PortalContent)])

    const root = nodeOps.createElement('div')
    render(h(Comp), root)

    await nextTick()

    expect(serializeInner(root)).toBe(`<!--[object Object]-->`)
    expect(serializeInner(portalRoot)).toBe(`<div>portal content</div>`)
  })

  test('portals require a valid, in DOM target after updates', async () => {
    const portalRoot = nodeOps.createElement('div')

    const PortalContent = () => h('div', 'portal content')

    const useValidTarget = ref(true)
    const Comp = () =>
      h(Portal, { target: useValidTarget.value ? portalRoot : null }, [
        h(PortalContent)
      ])

    const root = nodeOps.createElement('div')
    render(h(Comp), root)

    await nextTick()

    expect(serializeInner(root)).toBe(`<!--[object Object]-->`)
    expect(serializeInner(portalRoot)).toBe(`<div>portal content</div>`)

    useValidTarget.value = false

    await nextTick()
    expect('Invalid Portal target on update:').toHaveBeenWarned()
  })
})
