import {
  Fragment,
  getCurrentInstance,
  h,
  nextTick,
  nodeOps,
  ref,
  render,
  useInstanceInfo,
} from '@vue/runtime-test'

describe('useInstanceInfo', () => {
  test('returns null without an active instance', () => {
    expect(useInstanceInfo()).toBe(null)
  })

  test('is readonly', () => {
    let info: any
    const Comp = {
      setup() {
        info = useInstanceInfo()
        return () => null
      },
    }
    render(h(Comp), nodeOps.createElement('div'))
    const keys = [
      'uid',
      'type',
      'ce',
      'el',
      'isVapor',
      'isHydrating',
      'rawPropKeys',
    ]
    // nothing else on the object leads back to the instance
    expect(Reflect.ownKeys(info)).toEqual(keys)
    for (const key of keys) {
      expect(() => {
        info[key] = null
      }).toThrow(TypeError)
    }
  })

  test('exposes uid, type, ce and isVapor', () => {
    let info: any
    let instance: any
    const Comp = {
      setup() {
        info = useInstanceInfo()
        instance = getCurrentInstance()
        return () => null
      },
    }
    render(h(Comp), nodeOps.createElement('div'))
    expect(info.uid).toBe(instance.uid)
    expect(info.type).toBe(Comp)
    expect(info.ce).toBe(null)
    expect(info.isVapor).toBe(false)
  })

  test('rawPropKeys lists what the parent passed', () => {
    let info: any
    const Comp = {
      props: { open: Boolean, label: String },
      emits: ['change'],
      setup() {
        info = useInstanceInfo()
        return () => null
      },
    }
    const mount = (props?: Record<string, any>) => {
      render(h(Comp, props), nodeOps.createElement('div'))
      return info.rawPropKeys
    }
    expect(mount()).toEqual([])
    expect(mount({ open: false })).toEqual(['open'])
    expect(mount({ open: undefined })).toEqual(['open'])
    expect(mount({ open: true, onChange: () => {}, 'data-x': 1 })).toEqual([
      'open',
      'onChange',
      'data-x',
    ])
    // reserved props are not part of what the component receives
    expect(mount({ key: 'k', ref: ref(), open: false })).toEqual(['open'])
    expect(info.rawPropKeys).not.toBe(info.rawPropKeys)
  })

  test('rawPropKeys follows the parent', async () => {
    let info: any
    const passed = ref<Record<string, any>>({ open: false })
    const Comp = {
      props: { open: Boolean },
      setup() {
        info = useInstanceInfo()
        return () => null
      },
    }
    render(
      h(() => h(Comp, passed.value)),
      nodeOps.createElement('div'),
    )
    expect(info.rawPropKeys).toEqual(['open'])
    passed.value = {}
    await nextTick()
    expect(info.rawPropKeys).toEqual([])
  })

  test('el is null until mounted', () => {
    let info: any
    const inSetup: any[] = []
    const Comp = {
      setup() {
        info = useInstanceInfo()
        inSetup.push(info.el, info.isHydrating)
        return () => h('div')
      },
    }
    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(inSetup).toEqual([null, false])
    expect(info.el).toBe(root.children[0])
    expect(info.isHydrating).toBe(false)
  })

  test('el is null in setup when a mounted vnode is mounted again', () => {
    const inSetup: any[] = []
    const Comp = {
      setup() {
        const info = useInstanceInfo()!
        inSetup.push(info.el, info.isHydrating)
        return () => h('div')
      },
    }
    const vnode = h(Comp)
    const root = nodeOps.createElement('div')
    render(vnode, root)
    render(null, root)
    render(vnode, root)
    expect(inSetup).toEqual([null, false, null, false])
  })

  test('el is the root element, or the root elements in order', () => {
    let info: any
    const Inner = { render: () => h('p') }
    const mount = (renderFn: () => any) => {
      const root = nodeOps.createElement('div')
      const Comp = {
        setup() {
          info = useInstanceInfo()
          return renderFn
        },
      }
      render(h(Comp), root)
      return root
    }
    // several roots: past the anchors of the fragment
    let root = mount(() => [h('div'), h('span')])
    expect(info.el).toEqual(root.children.filter((c: any) => c.tag))
    // a component as the root
    root = mount(() => h(Inner))
    expect(info.el).toBe(root.children[0])
    // a first root that renders nothing
    root = mount(() => [null, h('span')])
    expect(info.el).toBe(root.children.find((c: any) => c.tag === 'span'))
    // no content
    mount(() => null)
    expect(info.el).toBe(null)
    // a fragment without children
    mount(() => h(Fragment))
    expect(info.el).toBe(null)
    root = mount(() => [h(Fragment), h('span')])
    expect(info.el).toBe(root.children.find((c: any) => c.tag === 'span'))
  })
})
