import {
  type Ref,
  type SetupContext,
  type VNode,
  h,
  inject,
  nextTick,
  nodeOps,
  provide,
  ref,
  render,
  serializeInner,
  watch,
} from '@vue/runtime-test'

describe('renderer: component', () => {
  test('should update parent(hoc) component host el when child component self update', async () => {
    const value = ref(true)
    let parentVnode: VNode
    let childVnode1: VNode
    let childVnode2: VNode

    const Parent = {
      render: () => {
        // let Parent first rerender
        return (parentVnode = h(Child))
      },
    }

    const Child = {
      render: () => {
        return value.value
          ? (childVnode1 = h('div'))
          : (childVnode2 = h('span'))
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Parent), root)
    expect(serializeInner(root)).toBe(`<div></div>`)
    expect(parentVnode!.el).toBe(childVnode1!.el)

    value.value = false
    await nextTick()
    expect(serializeInner(root)).toBe(`<span></span>`)
    expect(parentVnode!.el).toBe(childVnode2!.el)
  })

  it('should create an Component with props', () => {
    const Comp = {
      render: () => {
        return h('div')
      },
    }
    const root = nodeOps.createElement('div')
    render(h(Comp, { id: 'foo', class: 'bar' }), root)
    expect(serializeInner(root)).toBe(`<div id="foo" class="bar"></div>`)
  })

  it('should create an Component with direct text children', () => {
    const Comp = {
      render: () => {
        return h('div', 'test')
      },
    }
    const root = nodeOps.createElement('div')
    render(h(Comp, { id: 'foo', class: 'bar' }), root)
    expect(serializeInner(root)).toBe(`<div id="foo" class="bar">test</div>`)
  })

  it('should update an Component tag which is already mounted', () => {
    const Comp1 = {
      render: () => {
        return h('div', 'foo')
      },
    }
    const root = nodeOps.createElement('div')
    render(h(Comp1), root)
    expect(serializeInner(root)).toBe('<div>foo</div>')

    const Comp2 = {
      render: () => {
        return h('span', 'foo')
      },
    }
    render(h(Comp2), root)
    expect(serializeInner(root)).toBe('<span>foo</span>')
  })

  // #2072
  it('should not update Component if only changed props are declared emit listeners', () => {
    const Comp1 = {
      emits: ['foo'],
      updated: vi.fn(),
      render: () => null,
    }
    const root = nodeOps.createElement('div')
    render(
      h(Comp1, {
        onFoo: () => {},
      }),
      root,
    )
    render(
      h(Comp1, {
        onFoo: () => {},
      }),
      root,
    )
    expect(Comp1.updated).not.toHaveBeenCalled()
  })

  // #2043
  test('component child synchronously updating parent state should trigger parent re-render', async () => {
    const App = {
      setup() {
        const n = ref(0)
        provide('foo', n)
        return () => {
          return [h('div', n.value), h(Child)]
        }
      },
    }

    const Child = {
      setup() {
        const n = inject<Ref<number>>('foo')!
        n.value++

        return () => {
          return h('div', n.value)
        }
      },
    }

    const root = nodeOps.createElement('div')
    render(h(App), root)
    expect(serializeInner(root)).toBe(`<div>0</div><div>1</div>`)
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>1</div><div>1</div>`)
  })

  // #2170
  test('instance.$el should be exposed to watch options', async () => {
    function returnThis(this: any, _arg: any) {
      return this
    }
    const propWatchSpy = vi.fn(returnThis)
    const dataWatchSpy = vi.fn(returnThis)
    let instance: any
    const Comp = {
      props: {
        testProp: String,
      },

      data() {
        return {
          testData: undefined,
        }
      },

      watch: {
        testProp() {
          // @ts-expect-error
          propWatchSpy(this.$el)
        },
        testData() {
          // @ts-expect-error
          dataWatchSpy(this.$el)
        },
      },

      created() {
        instance = this
      },

      render() {
        return h('div')
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    await nextTick()
    expect(propWatchSpy).not.toHaveBeenCalled()
    expect(dataWatchSpy).not.toHaveBeenCalled()

    render(h(Comp, { testProp: 'prop ' }), root)
    await nextTick()
    expect(propWatchSpy).toHaveBeenCalledWith(instance.$el)

    instance.testData = 1
    await nextTick()
    expect(dataWatchSpy).toHaveBeenCalledWith(instance.$el)
  })

  // #2200
  test('component child updating parent state in pre-flush should trigger parent re-render', async () => {
    const outer = ref(0)
    const App = {
      setup() {
        const inner = ref(0)

        return () => {
          return [
            h('div', inner.value),
            h(Child, {
              value: outer.value,
              onUpdate: (val: number) => (inner.value = val),
            }),
          ]
        }
      },
    }

    const Child = {
      props: ['value'],
      setup(props: any, { emit }: SetupContext) {
        watch(
          () => props.value,
          (val: number) => emit('update', val),
        )

        return () => {
          return h('div', props.value)
        }
      },
    }

    const root = nodeOps.createElement('div')
    render(h(App), root)
    expect(serializeInner(root)).toBe(`<div>0</div><div>0</div>`)

    outer.value++
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>1</div><div>1</div>`)
  })

  test('child only updates once when triggered in multiple ways', async () => {
    const a = ref(0)
    const calls: string[] = []

    const Parent = {
      setup() {
        return () => {
          calls.push('render parent')
          return h(Child, { count: a.value }, () => a.value)
        }
      },
    }

    const Child = {
      props: ['count'],
      setup(props: any) {
        return () => {
          calls.push('render child')
          return `${props.count} - ${a.value}`
        }
      },
    }

    render(h(Parent), nodeOps.createElement('div'))
    expect(calls).toEqual(['render parent', 'render child'])

    // This will trigger child rendering directly, as well as via a prop change
    a.value++
    await nextTick()
    expect(calls).toEqual([
      'render parent',
      'render child',
      'render parent',
      'render child',
    ])
  })

  // #7745
  test(`an earlier update doesn't lead to excessive subsequent updates`, async () => {
    const globalCount = ref(0)
    const parentCount = ref(0)
    const calls: string[] = []

    const Root = {
      setup() {
        return () => {
          calls.push('render root')
          return h(Parent, { count: globalCount.value })
        }
      },
    }

    const Parent = {
      props: ['count'],
      setup(props: any) {
        return () => {
          calls.push('render parent')
          return [
            `${globalCount.value} - ${props.count}`,
            h(Child, { count: parentCount.value }),
          ]
        }
      },
    }

    const Child = {
      props: ['count'],
      setup(props: any) {
        watch(
          () => props.count,
          () => {
            calls.push('child watcher')
            globalCount.value = props.count
          },
        )

        return () => {
          calls.push('render child')
        }
      },
    }

    render(h(Root), nodeOps.createElement('div'))
    expect(calls).toEqual(['render root', 'render parent', 'render child'])

    parentCount.value++
    await nextTick()
    expect(calls).toEqual([
      'render root',
      'render parent',
      'render child',
      'render parent',
      'child watcher',
      'render child',
      'render root',
      'render parent',
    ])
  })

  // #2521
  test('should pause tracking deps when initializing legacy options', async () => {
    let childInstance = null as any
    const Child = {
      props: ['foo'],
      data() {
        return {
          count: 0,
        }
      },
      watch: {
        foo: {
          immediate: true,
          handler() {
            ;(this as any).count
          },
        },
      },
      created() {
        childInstance = this as any
        childInstance.count
      },
      render() {
        return h('h1', (this as any).count)
      },
    }

    const App = {
      setup() {
        return () => h(Child)
      },
      updated: vi.fn(),
    }

    const root = nodeOps.createElement('div')
    render(h(App), root)
    expect(App.updated).toHaveBeenCalledTimes(0)

    childInstance.count++
    await nextTick()
    expect(App.updated).toHaveBeenCalledTimes(0)
  })

  describe('render with access caches', () => {
    // #3297
    test('should not set the access cache in the data() function (production mode)', () => {
      const Comp = {
        data() {
          ;(this as any).foo
          return { foo: 1 }
        },
        render() {
          return h('h1', (this as any).foo)
        },
      }
      const root = nodeOps.createElement('div')

      __DEV__ = false
      render(h(Comp), root)
      __DEV__ = true
      expect(serializeInner(root)).toBe(`<h1>1</h1>`)
    })
  })

  test('the component VNode should be cloned when reusing it', () => {
    const App = {
      render() {
        const c = [h(Comp)]
        return [c, c, c]
      },
    }

    const ids: number[] = []
    const Comp = {
      render: () => h('h1'),
      beforeUnmount() {
        ids.push((this as any).$.uid)
      },
    }

    const root = nodeOps.createElement('div')
    render(h(App), root)
    expect(serializeInner(root)).toBe(`<h1></h1><h1></h1><h1></h1>`)

    render(null, root)
    expect(serializeInner(root)).toBe(``)
    expect(ids).toEqual([ids[0], ids[0] + 1, ids[0] + 2])
  })

  test('child component props update should not lead to double update', async () => {
    const text = ref(0)
    const spy = vi.fn()

    const App = {
      render() {
        return h(Comp, { text: text.value })
      },
    }

    const Comp = {
      props: ['text'],
      render(this: any) {
        spy()
        return h('h1', this.text)
      },
    }

    const root = nodeOps.createElement('div')
    render(h(App), root)

    expect(serializeInner(root)).toBe(`<h1>0</h1>`)
    expect(spy).toHaveBeenCalledTimes(1)

    text.value++
    await nextTick()
    expect(serializeInner(root)).toBe(`<h1>1</h1>`)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('should warn accessing `this` in a <script setup> template', () => {
    const App = {
      setup() {
        return {
          __isScriptSetup: true,
        }
      },

      render(this: any) {
        return this.$attrs.id
      },
    }

    const root = nodeOps.createElement('div')
    render(h(App), root)

    expect(
      `Property '$attrs' was accessed via 'this'. Avoid using 'this' in templates.`,
    ).toHaveBeenWarned()
  })
})
