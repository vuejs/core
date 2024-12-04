import type { NodeRef } from 'packages/runtime-vapor/src/dom/templateRef'
import {
  createFor,
  createIf,
  getCurrentInstance,
  insert,
  nextTick,
  reactive,
  ref,
  renderEffect,
  setRef,
  setText,
  template,
  watchEffect,
} from '../../src'
import { makeRender } from '../_utils'

const define = makeRender()

describe('api: template ref', () => {
  test('string ref mount', () => {
    const t0 = template('<div ref="refKey"></div>')
    const el = ref(null)
    const { render } = define({
      setup() {
        return {
          refKey: el,
        }
      },
      render() {
        const n0 = t0()
        setRef(n0 as Element, 'refKey')
        return n0
      },
    })

    const { host } = render()
    expect(el.value).toBe(host.children[0])
  })

  it('string ref update', async () => {
    const t0 = template('<div></div>')
    const fooEl = ref(null)
    const barEl = ref(null)
    const refKey = ref('foo')

    const { render } = define({
      setup() {
        return {
          foo: fooEl,
          bar: barEl,
        }
      },
      render() {
        const n0 = t0()
        let r0: NodeRef | undefined
        renderEffect(() => {
          r0 = setRef(n0 as Element, refKey.value, r0)
        })
        return n0
      },
    })
    const { host } = render()
    expect(fooEl.value).toBe(host.children[0])
    expect(barEl.value).toBe(null)

    refKey.value = 'bar'
    await nextTick()
    expect(barEl.value).toBe(host.children[0])
    expect(fooEl.value).toBe(null)
  })

  it('string ref unmount', async () => {
    const t0 = template('<div></div>')
    const el = ref(null)
    const toggle = ref(true)

    const { render } = define({
      setup() {
        return {
          refKey: el,
        }
      },
      render() {
        const n0 = createIf(
          () => toggle.value,
          () => {
            const n1 = t0()
            setRef(n1 as Element, 'refKey')
            return n1
          },
        )
        return n0
      },
    })
    const { host } = render()
    expect(el.value).toBe(host.children[0])

    toggle.value = false
    await nextTick()
    expect(el.value).toBe(null)
  })

  it('function ref mount', () => {
    const fn = vi.fn()
    const t0 = template('<div></div>')
    const { render } = define({
      render() {
        const n0 = t0()
        setRef(n0 as Element, fn)
        return n0
      },
    })

    const { host } = render()
    expect(fn.mock.calls[0][0]).toBe(host.children[0])
  })

  it('function ref update', async () => {
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    const fn = ref(fn1)

    const t0 = template('<div></div>')
    const { render } = define({
      render() {
        const n0 = t0()
        let r0: NodeRef | undefined
        renderEffect(() => {
          r0 = setRef(n0 as Element, fn.value, r0)
        })
        return n0
      },
    })

    const { host } = render()

    expect(fn1.mock.calls).toHaveLength(1)
    expect(fn1.mock.calls[0][0]).toBe(host.children[0])
    expect(fn2.mock.calls).toHaveLength(0)

    fn.value = fn2
    await nextTick()
    expect(fn1.mock.calls).toHaveLength(1)
    expect(fn2.mock.calls).toHaveLength(1)
    expect(fn2.mock.calls[0][0]).toBe(host.children[0])
  })

  it('function ref unmount', async () => {
    const fn = vi.fn()
    const toggle = ref(true)

    const t0 = template('<div></div>')
    const { render } = define({
      render() {
        const n0 = createIf(
          () => toggle.value,
          () => {
            const n1 = t0()
            setRef(n1 as Element, fn)
            return n1
          },
        )
        return n0
      },
    })
    const { host } = render()
    expect(fn.mock.calls[0][0]).toBe(host.children[0])
    toggle.value = false
    await nextTick()
    expect(fn.mock.calls[1][0]).toBe(undefined)
  })

  it('should work with direct reactive property', () => {
    const state = reactive({
      refKey: null,
    })

    const t0 = template('<div></div>')
    const { render } = define({
      setup() {
        return state
      },
      render() {
        const n0 = t0()
        setRef(n0 as Element, 'refKey')
        return n0
      },
    })
    const { host } = render()
    expect(state.refKey).toBe(host.children[0])
  })

  test('multiple root refs', () => {
    const refKey1 = ref(null)
    const refKey2 = ref(null)
    const refKey3 = ref(null)

    const t0 = template('<div></div>')
    const t1 = template('<div></div>')
    const t2 = template('<div></div>')
    const { render } = define({
      setup() {
        return {
          refKey1,
          refKey2,
          refKey3,
        }
      },
      render() {
        const n0 = t0()
        const n1 = t1()
        const n2 = t2()
        setRef(n0 as Element, 'refKey1')
        setRef(n1 as Element, 'refKey2')
        setRef(n2 as Element, 'refKey3')
        return [n0, n1, n2]
      },
    })
    const { host } = render()
    // Note: toBe Condition is different from core test case
    // Core test case is expecting refKey1.value to be host.children[1]
    expect(refKey1.value).toBe(host.children[0])
    expect(refKey2.value).toBe(host.children[1])
    expect(refKey3.value).toBe(host.children[2])
  })

  // #1505
  test('reactive template ref in the same template', async () => {
    const t0 = template('<div id="foo"></div>')
    const el = ref<HTMLElement>()
    const { render } = define({
      render() {
        const n0 = t0()
        setRef(n0 as Element, el)
        renderEffect(() => {
          setText(n0, el.value && el.value.getAttribute('id'))
        })
        return n0
      },
    })

    const { host } = render()
    // ref not ready on first render, but should queue an update immediately
    expect(host.innerHTML).toBe(`<div id="foo"></div>`)
    await nextTick()
    // ref should be updated
    expect(host.innerHTML).toBe(`<div id="foo">foo</div>`)
  })

  // #1834
  test('exchange refs', async () => {
    const refToggle = ref(false)
    const spy = vi.fn()

    const t0 = template('<p></p>')
    const t1 = template('<i></i>')
    const { render } = define({
      render() {
        const instance = getCurrentInstance()!
        const n0 = t0()
        const n1 = t1()
        let r0: NodeRef | undefined
        let r1: NodeRef | undefined
        renderEffect(() => {
          r0 = setRef(n0 as Element, refToggle.value ? 'foo' : 'bar', r0)
        })
        renderEffect(() => {
          r1 = setRef(n1 as Element, refToggle.value ? 'bar' : 'foo', r1)
        })
        watchEffect(
          () => {
            refToggle.value
            spy(
              (instance.refs.foo as HTMLElement).tagName,
              (instance.refs.bar as HTMLElement).tagName,
            )
          },
          {
            flush: 'post',
          },
        )
        return [n0, n1]
      },
    })

    render()

    expect(spy.mock.calls[0][0]).toBe('I')
    expect(spy.mock.calls[0][1]).toBe('P')
    refToggle.value = true
    await nextTick()
    expect(spy.mock.calls[1][0]).toBe('P')
    expect(spy.mock.calls[1][1]).toBe('I')
  })

  // #1789
  test('toggle the same ref to different elements', async () => {
    const refToggle = ref(false)
    const spy = vi.fn()

    const t0 = template('<p></p>')
    const t1 = template('<i></i>')
    const { render } = define({
      render() {
        const instance = getCurrentInstance()!
        const n0 = createIf(
          () => refToggle.value,
          () => {
            const n1 = t0()
            setRef(n1 as Element, 'foo')
            return n1
          },
          () => {
            const n1 = t1()
            setRef(n1 as Element, 'foo')
            return n1
          },
        )
        watchEffect(
          () => {
            refToggle.value
            spy((instance.refs.foo as HTMLElement).tagName)
          },
          {
            flush: 'post',
          },
        )
        return [n0]
      },
    })

    render()

    expect(spy.mock.calls[0][0]).toBe('I')
    refToggle.value = true
    await nextTick()
    expect(spy.mock.calls[1][0]).toBe('P')
  })

  // compiled output of v-for + template ref
  test('ref in v-for', async () => {
    const show = ref(true)
    const list = reactive([1, 2, 3])
    const listRefs = ref([])
    const mapRefs = () => listRefs.value.map((n: HTMLElement) => n.innerHTML)

    const t0 = template('<ul></ul>')
    const t1 = template('<li></li>')
    const { render } = define({
      render() {
        const n0 = createIf(
          () => show.value,
          () => {
            const n1 = t0()
            const n2 = createFor(
              () => list,
              state => {
                const n1 = t1()
                setRef(n1 as Element, listRefs, undefined, true)
                renderEffect(() => {
                  const [item] = state
                  setText(n1, item)
                })
                return n1
              },
            )
            insert(n2, n1 as ParentNode)
            return n1
          },
        )
        return n0
      },
    })
    render()

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
    const mapRefs = () => listRefs.value.map((n: HTMLElement) => n.innerHTML)

    const t0 = template('<ul></ul>')
    const t1 = template('<li></li>')
    const { render } = define({
      setup() {
        return { listRefs }
      },
      render() {
        const n0 = createIf(
          () => show.value,
          () => {
            const n1 = t0()
            const n2 = createFor(
              () => list,
              state => {
                const n1 = t1()
                setRef(n1 as Element, 'listRefs', undefined, true)
                renderEffect(() => {
                  const [item] = state
                  setText(n1, item)
                })
                return n1
              },
            )
            insert(n2, n1 as ParentNode)
            return n1
          },
        )
        return n0
      },
    })
    render()

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

    const t0 = template('<div><div></div><ul></ul></div>')
    const t1 = template('<li></li>')
    const { render } = define({
      setup() {
        return { listRefs }
      },
      render() {
        const n0 = t0()
        const n1 = n0.firstChild
        const n2 = n1!.nextSibling!
        const n3 = createFor(
          () => list.value,
          state => {
            const n4 = t1()
            setRef(n4 as Element, 'listRefs', undefined, true)
            renderEffect(() => {
              const [item] = state
              setText(n4, item)
            })
            return n4
          },
        )
        insert(n3, n2 as unknown as ParentNode)
        renderEffect(() => {
          setText(n1!, String(listRefs.value))
        })
        return n0
      },
    })

    const { host } = render()

    await nextTick()
    expect(String(listRefs.value)).toBe(
      '[object HTMLLIElement],[object HTMLLIElement],[object HTMLLIElement]',
    )
    expect(host.innerHTML).toBe(
      '<div><div>[object HTMLLIElement],[object HTMLLIElement],[object HTMLLIElement]</div><ul><li>1</li><li>2</li><li>3</li><!--for--></ul></div>',
    )

    list.value.splice(0, 1)
    await nextTick()
    expect(String(listRefs.value)).toBe(
      '[object HTMLLIElement],[object HTMLLIElement]',
    )
    expect(host.innerHTML).toBe(
      '<div><div>[object HTMLLIElement],[object HTMLLIElement]</div><ul><li>2</li><li>3</li><!--for--></ul></div>',
    )
  })

  // TODO: need to implement Component slots
  // test('string ref inside slots', async () => {
  //   const spy = vi.fn()
  //   const { component: Child } = define({
  //     render(this: any) {
  //       return this.$slots.default()
  //     },
  //   })
  //   const { render } = define({
  //     render() {
  //       onMounted(function (this: any) {
  //         spy(this.$refs.foo.tag)
  //       })
  //       const n0 = createComponent(Child)
  //       setRef(n0, 'foo')
  //       return n0
  //     },
  //   })
  //   const { host } = render()

  //   expect(spy).toHaveBeenCalledWith('div')
  // })

  //TODO: need setup return render function
  // it('render function ref mount', () => {
  //   const el = ref(null)

  //   const Comp = define({
  //     setup() {
  //       return () => h('div', { ref: el })
  //     },
  //   })
  //   render(h(Comp), root)
  //   expect(el.value).toBe(root.children[0])
  // })

  // it('render function ref update', async () => {
  //   const root = nodeOps.createElement('div')
  //   const refs = {
  //     foo: ref(null),
  //     bar: ref(null),
  //   }
  //   const refKey = ref<keyof typeof refs>('foo')

  //   const Comp = {
  //     setup() {
  //       return () => h('div', { ref: refs[refKey.value] })
  //     },
  //   }
  //   render(h(Comp), root)
  //   expect(refs.foo.value).toBe(root.children[0])
  //   expect(refs.bar.value).toBe(null)

  //   refKey.value = 'bar'
  //   await nextTick()
  //   expect(refs.foo.value).toBe(null)
  //   expect(refs.bar.value).toBe(root.children[0])
  // })

  // it('render function ref unmount', async () => {
  //   const root = nodeOps.createElement('div')
  //   const el = ref(null)
  //   const toggle = ref(true)

  //   const Comp = {
  //     setup() {
  //       return () => (toggle.value ? h('div', { ref: el }) : null)
  //     },
  //   }
  //   render(h(Comp), root)
  //   expect(el.value).toBe(root.children[0])

  //   toggle.value = false
  //   await nextTick()
  //   expect(el.value).toBe(null)
  // })

  // TODO: can not reproduce in Vapor
  // // #2078
  // test('handling multiple merged refs', async () => {
  //   const Foo = {
  //     render: () => h('div', 'foo'),
  //   }
  //   const Bar = {
  //     render: () => h('div', 'bar'),
  //   }

  //   const viewRef = shallowRef<any>(Foo)
  //   const elRef1 = ref()
  //   const elRef2 = ref()

  //   const App = {
  //     render() {
  //       if (!viewRef.value) {
  //         return null
  //       }
  //       const view = h(viewRef.value, { ref: elRef1 })
  //       return h(view, { ref: elRef2 })
  //     },
  //   }
  //   const root = nodeOps.createElement('div')
  //   render(h(App), root)

  //   expect(serializeInner(elRef1.value.$el)).toBe('foo')
  //   expect(elRef1.value).toBe(elRef2.value)

  //   viewRef.value = Bar
  //   await nextTick()
  //   expect(serializeInner(elRef1.value.$el)).toBe('bar')
  //   expect(elRef1.value).toBe(elRef2.value)

  //   viewRef.value = null
  //   await nextTick()
  //   expect(elRef1.value).toBeNull()
  //   expect(elRef1.value).toBe(elRef2.value)
  // })
})
