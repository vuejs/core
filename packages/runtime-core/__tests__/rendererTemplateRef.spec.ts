import { vi } from 'vitest'
import {
  ref,
  nodeOps,
  h,
  render,
  nextTick,
  defineComponent,
  reactive,
  serializeInner,
  shallowRef
} from '@vue/runtime-test'

// reference: https://vue-composition-api-rfc.netlify.com/api.html#template-refs

describe('api: template refs', () => {
  it('string ref mount', () => {
    const root = nodeOps.createElement('div')
    const el = ref(null)

    const Comp = {
      setup() {
        return {
          refKey: el
        }
      },
      render() {
        return h('div', { ref: 'refKey' })
      }
    }
    render(h(Comp), root)
    expect(el.value).toBe(root.children[0])
  })

  it('string ref update', async () => {
    const root = nodeOps.createElement('div')
    const fooEl = ref(null)
    const barEl = ref(null)
    const refKey = ref('foo')

    const Comp = {
      setup() {
        return {
          foo: fooEl,
          bar: barEl
        }
      },
      render() {
        return h('div', { ref: refKey.value })
      }
    }
    render(h(Comp), root)
    expect(fooEl.value).toBe(root.children[0])
    expect(barEl.value).toBe(null)

    refKey.value = 'bar'
    await nextTick()
    expect(fooEl.value).toBe(null)
    expect(barEl.value).toBe(root.children[0])
  })

  it('string ref unmount', async () => {
    const root = nodeOps.createElement('div')
    const el = ref(null)
    const toggle = ref(true)

    const Comp = {
      setup() {
        return {
          refKey: el
        }
      },
      render() {
        return toggle.value ? h('div', { ref: 'refKey' }) : null
      }
    }
    render(h(Comp), root)
    expect(el.value).toBe(root.children[0])

    toggle.value = false
    await nextTick()
    expect(el.value).toBe(null)
  })

  it('function ref mount', () => {
    const root = nodeOps.createElement('div')
    const fn = vi.fn()

    const Comp = defineComponent(() => () => h('div', { ref: fn }))
    render(h(Comp), root)
    expect(fn.mock.calls[0][0]).toBe(root.children[0])
  })

  it('function ref update', async () => {
    const root = nodeOps.createElement('div')
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    const fn = ref(fn1)

    const Comp = defineComponent(() => () => h('div', { ref: fn.value }))

    render(h(Comp), root)
    expect(fn1.mock.calls).toHaveLength(1)
    expect(fn1.mock.calls[0][0]).toBe(root.children[0])
    expect(fn2.mock.calls).toHaveLength(0)

    fn.value = fn2
    await nextTick()
    expect(fn1.mock.calls).toHaveLength(1)
    expect(fn2.mock.calls).toHaveLength(1)
    expect(fn2.mock.calls[0][0]).toBe(root.children[0])
  })

  it('function ref unmount', async () => {
    const root = nodeOps.createElement('div')
    const fn = vi.fn()
    const toggle = ref(true)

    const Comp = defineComponent(
      () => () => toggle.value ? h('div', { ref: fn }) : null
    )
    render(h(Comp), root)
    expect(fn.mock.calls[0][0]).toBe(root.children[0])
    toggle.value = false
    await nextTick()
    expect(fn.mock.calls[1][0]).toBe(null)
  })

  it('render function ref mount', () => {
    const root = nodeOps.createElement('div')
    const el = ref(null)

    const Comp = {
      setup() {
        return () => h('div', { ref: el })
      }
    }
    render(h(Comp), root)
    expect(el.value).toBe(root.children[0])
  })

  it('render function ref update', async () => {
    const root = nodeOps.createElement('div')
    const refs = {
      foo: ref(null),
      bar: ref(null)
    }
    const refKey = ref<keyof typeof refs>('foo')

    const Comp = {
      setup() {
        return () => h('div', { ref: refs[refKey.value] })
      }
    }
    render(h(Comp), root)
    expect(refs.foo.value).toBe(root.children[0])
    expect(refs.bar.value).toBe(null)

    refKey.value = 'bar'
    await nextTick()
    expect(refs.foo.value).toBe(null)
    expect(refs.bar.value).toBe(root.children[0])
  })

  it('render function ref unmount', async () => {
    const root = nodeOps.createElement('div')
    const el = ref(null)
    const toggle = ref(true)

    const Comp = {
      setup() {
        return () => (toggle.value ? h('div', { ref: el }) : null)
      }
    }
    render(h(Comp), root)
    expect(el.value).toBe(root.children[0])

    toggle.value = false
    await nextTick()
    expect(el.value).toBe(null)
  })

  test('string ref inside slots', async () => {
    const root = nodeOps.createElement('div')
    const spy = vi.fn()
    const Child = {
      render(this: any) {
        return this.$slots.default()
      }
    }

    const Comp = {
      render() {
        return h(Child, () => {
          return h('div', { ref: 'foo' })
        })
      },
      mounted(this: any) {
        spy(this.$refs.foo.tag)
      }
    }
    render(h(Comp), root)

    expect(spy).toHaveBeenCalledWith('div')
  })

  it('should work with direct reactive property', () => {
    const root = nodeOps.createElement('div')
    const state = reactive({
      refKey: null
    })

    const Comp = {
      setup() {
        return state
      },
      render() {
        return h('div', { ref: 'refKey' })
      }
    }
    render(h(Comp), root)
    expect(state.refKey).toBe(root.children[0])
  })

  test('multiple root refs', () => {
    const root = nodeOps.createElement('div')
    const refKey1 = ref(null)
    const refKey2 = ref(null)
    const refKey3 = ref(null)

    const Comp = {
      setup() {
        return {
          refKey1,
          refKey2,
          refKey3
        }
      },
      render() {
        return [
          h('div', { ref: 'refKey1' }),
          h('div', { ref: 'refKey2' }),
          h('div', { ref: 'refKey3' })
        ]
      }
    }
    render(h(Comp), root)
    expect(refKey1.value).toBe(root.children[1])
    expect(refKey2.value).toBe(root.children[2])
    expect(refKey3.value).toBe(root.children[3])
  })

  // #1505
  test('reactive template ref in the same template', async () => {
    const Comp = {
      setup() {
        const el = ref()
        return { el }
      },
      render(this: any) {
        return h('div', { id: 'foo', ref: 'el' }, this.el && this.el.props.id)
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    // ref not ready on first render, but should queue an update immediately
    expect(serializeInner(root)).toBe(`<div id="foo"></div>`)
    await nextTick()
    // ref should be updated
    expect(serializeInner(root)).toBe(`<div id="foo">foo</div>`)
  })

  // #1834
  test('exchange refs', async () => {
    const refToggle = ref(false)
    const spy = vi.fn()

    const Comp = {
      render(this: any) {
        return [
          h('p', { ref: refToggle.value ? 'foo' : 'bar' }),
          h('i', { ref: refToggle.value ? 'bar' : 'foo' })
        ]
      },
      mounted(this: any) {
        spy(this.$refs.foo.tag, this.$refs.bar.tag)
      },
      updated(this: any) {
        spy(this.$refs.foo.tag, this.$refs.bar.tag)
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)

    expect(spy.mock.calls[0][0]).toBe('i')
    expect(spy.mock.calls[0][1]).toBe('p')
    refToggle.value = true
    await nextTick()
    expect(spy.mock.calls[1][0]).toBe('p')
    expect(spy.mock.calls[1][1]).toBe('i')
  })

  // #1789
  test('toggle the same ref to different elements', async () => {
    const refToggle = ref(false)
    const spy = vi.fn()

    const Comp = {
      render(this: any) {
        return refToggle.value ? h('p', { ref: 'foo' }) : h('i', { ref: 'foo' })
      },
      mounted(this: any) {
        spy(this.$refs.foo.tag)
      },
      updated(this: any) {
        spy(this.$refs.foo.tag)
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)

    expect(spy.mock.calls[0][0]).toBe('i')
    refToggle.value = true
    await nextTick()
    expect(spy.mock.calls[1][0]).toBe('p')
  })

  // #2078
  test('handling multiple merged refs', async () => {
    const Foo = {
      render: () => h('div', 'foo')
    }
    const Bar = {
      render: () => h('div', 'bar')
    }

    const viewRef = shallowRef<any>(Foo)
    const elRef1 = ref()
    const elRef2 = ref()

    const App = {
      render() {
        if (!viewRef.value) {
          return null
        }
        const view = h(viewRef.value, { ref: elRef1 })
        return h(view, { ref: elRef2 })
      }
    }
    const root = nodeOps.createElement('div')
    render(h(App), root)

    expect(serializeInner(elRef1.value.$el)).toBe('foo')
    expect(elRef1.value).toBe(elRef2.value)

    viewRef.value = Bar
    await nextTick()
    expect(serializeInner(elRef1.value.$el)).toBe('bar')
    expect(elRef1.value).toBe(elRef2.value)

    viewRef.value = null
    await nextTick()
    expect(elRef1.value).toBeNull()
    expect(elRef1.value).toBe(elRef2.value)
  })

  // compiled output of <script setup> inline mode
  test('raw ref with ref_key', () => {
    let refs: any

    const el = ref()

    const App = {
      mounted() {
        refs = (this as any).$refs
      },
      render() {
        return h(
          'div',
          {
            ref: el,
            ref_key: 'el'
          },
          'hello'
        )
      }
    }
    const root = nodeOps.createElement('div')
    render(h(App), root)

    expect(serializeInner(el.value)).toBe('hello')
    expect(serializeInner(refs.el)).toBe('hello')
  })

  // compiled output of v-for + template ref
  test('ref in v-for', async () => {
    const show = ref(true)
    const list = reactive([1, 2, 3])
    const listRefs = ref([])
    const mapRefs = () => listRefs.value.map(n => serializeInner(n))

    const App = {
      render() {
        return show.value
          ? h(
              'ul',
              list.map(i =>
                h(
                  'li',
                  {
                    ref: listRefs,
                    ref_for: true
                  },
                  i
                )
              )
            )
          : null
      }
    }
    const root = nodeOps.createElement('div')
    render(h(App), root)

    expect(mapRefs()).toMatchObject(['1', '2', '3'])

    list.push(4)
    await nextTick()
    expect(mapRefs()).toMatchObject(['1', '2', '3', '4'])

    list.shift()
    await nextTick()
    expect(mapRefs()).toMatchObject(['2', '3', '4'])

    show.value = !show.value
    await nextTick()

    expect(mapRefs()).toMatchObject([])

    show.value = !show.value
    await nextTick()
    expect(mapRefs()).toMatchObject(['2', '3', '4'])
  })

  test('named ref in v-for', async () => {
    const show = ref(true)
    const list = reactive([1, 2, 3])
    const listRefs = ref([])
    const mapRefs = () => listRefs.value.map(n => serializeInner(n))

    const App = {
      setup() {
        return { listRefs }
      },
      render() {
        return show.value
          ? h(
              'ul',
              list.map(i =>
                h(
                  'li',
                  {
                    ref: 'listRefs',
                    ref_for: true
                  },
                  i
                )
              )
            )
          : null
      }
    }
    const root = nodeOps.createElement('div')
    render(h(App), root)

    expect(mapRefs()).toMatchObject(['1', '2', '3'])

    list.push(4)
    await nextTick()
    expect(mapRefs()).toMatchObject(['1', '2', '3', '4'])

    list.shift()
    await nextTick()
    expect(mapRefs()).toMatchObject(['2', '3', '4'])

    show.value = !show.value
    await nextTick()

    expect(mapRefs()).toMatchObject([])

    show.value = !show.value
    await nextTick()
    expect(mapRefs()).toMatchObject(['2', '3', '4'])
  })

  // #6697 v-for ref behaves differently under production and development
  test('named ref in v-for , should be responsive when rendering', async () => {
    const list = ref([1, 2, 3])
    const listRefs = ref([])
    const App = {
      setup() {
        return { listRefs }
      },
      render() {
        return h('div', null, [
          h('div', null, String(listRefs.value)),
          h(
            'ul',
            list.value.map(i =>
              h(
                'li',
                {
                  ref: 'listRefs',
                  ref_for: true
                },
                i
              )
            )
          )
        ])
      }
    }
    const root = nodeOps.createElement('div')
    render(h(App), root)

    await nextTick()
    expect(String(listRefs.value)).toBe(
      '[object Object],[object Object],[object Object]'
    )
    expect(serializeInner(root)).toBe(
      '<div><div>[object Object],[object Object],[object Object]</div><ul><li>1</li><li>2</li><li>3</li></ul></div>'
    )

    list.value.splice(0, 1)
    await nextTick()
    expect(String(listRefs.value)).toBe('[object Object],[object Object]')
    expect(serializeInner(root)).toBe(
      '<div><div>[object Object],[object Object]</div><ul><li>2</li><li>3</li></ul></div>'
    )
  })
})
