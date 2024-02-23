import {
  Fragment,
  type Ref,
  createApp,
  createBlock,
  createElementBlock,
  createElementVNode,
  createVNode,
  defineComponent,
  h,
  nextTick,
  nodeOps,
  openBlock,
  ref,
  render,
  serializeInner,
  watch,
} from '@vue/runtime-test'
import { useModel } from '../../src/helpers/useModel'

describe('useModel', () => {
  test('basic', async () => {
    let foo: any
    const update = () => {
      foo.value = 'bar'
    }

    const compRender = vi.fn()
    const Comp = defineComponent({
      props: ['modelValue'],
      emits: ['update:modelValue'],
      setup(props) {
        foo = useModel(props, 'modelValue')
        return () => {
          compRender()
          return foo.value
        }
      },
    })

    const msg = ref('')
    const setValue = vi.fn(v => (msg.value = v))
    const root = nodeOps.createElement('div')
    createApp(() =>
      h(Comp, {
        modelValue: msg.value,
        'onUpdate:modelValue': setValue,
      }),
    ).mount(root)

    expect(foo.value).toBe('')
    expect(msg.value).toBe('')
    expect(setValue).not.toBeCalled()
    expect(compRender).toBeCalledTimes(1)
    expect(serializeInner(root)).toBe('')

    // update from child
    update()

    await nextTick()
    expect(msg.value).toBe('bar')
    expect(foo.value).toBe('bar')
    expect(setValue).toBeCalledTimes(1)
    expect(compRender).toBeCalledTimes(2)
    expect(serializeInner(root)).toBe('bar')

    // update from parent
    msg.value = 'qux'
    expect(msg.value).toBe('qux')

    await nextTick()
    expect(msg.value).toBe('qux')
    expect(foo.value).toBe('qux')
    expect(setValue).toBeCalledTimes(1)
    expect(compRender).toBeCalledTimes(3)
    expect(serializeInner(root)).toBe('qux')
  })

  test('without parent value (local mutation)', async () => {
    let foo: any
    const update = () => {
      foo.value = 'bar'
    }

    const compRender = vi.fn()
    const Comp = defineComponent({
      props: ['foo'],
      emits: ['update:foo'],
      setup(props) {
        foo = useModel(props, 'foo')
        return () => {
          compRender()
          return foo.value
        }
      },
    })

    const root = nodeOps.createElement('div')
    const updateFoo = vi.fn()
    render(h(Comp, { 'onUpdate:foo': updateFoo }), root)
    expect(compRender).toBeCalledTimes(1)
    expect(serializeInner(root)).toBe('<!---->')

    expect(foo.value).toBeUndefined()
    update()
    // when parent didn't provide value, local mutation is enabled
    expect(foo.value).toBe('bar')

    await nextTick()
    expect(updateFoo).toBeCalledTimes(1)
    expect(compRender).toBeCalledTimes(2)
    expect(serializeInner(root)).toBe('bar')
  })

  test('without parent listener (local mutation)', async () => {
    let foo: any
    const update = () => {
      foo.value = 'bar'
    }

    const compRender = vi.fn()
    const Comp = defineComponent({
      props: ['foo'],
      emits: ['update:foo'],
      setup(props) {
        foo = useModel(props, 'foo')
        return () => {
          compRender()
          return foo.value
        }
      },
    })

    const root = nodeOps.createElement('div')
    // provide initial value
    render(h(Comp, { foo: 'initial' }), root)
    expect(compRender).toBeCalledTimes(1)
    expect(serializeInner(root)).toBe('initial')

    expect(foo.value).toBe('initial')
    update()
    // when parent didn't provide value, local mutation is enabled
    expect(foo.value).toBe('bar')

    await nextTick()
    expect(compRender).toBeCalledTimes(2)
    expect(serializeInner(root)).toBe('bar')
  })

  test('kebab-case v-model (should not be local)', async () => {
    let foo: any

    const compRender = vi.fn()
    const Comp = defineComponent({
      props: ['fooBar'],
      emits: ['update:fooBar'],
      setup(props) {
        foo = useModel(props, 'fooBar')
        return () => {
          compRender()
          return foo.value
        }
      },
    })

    const updateFooBar = vi.fn()
    const root = nodeOps.createElement('div')
    // v-model:foo-bar compiles to foo-bar and onUpdate:fooBar
    render(
      h(Comp, { 'foo-bar': 'initial', 'onUpdate:fooBar': updateFooBar }),
      root,
    )
    expect(compRender).toBeCalledTimes(1)
    expect(serializeInner(root)).toBe('initial')

    expect(foo.value).toBe('initial')
    foo.value = 'bar'
    // should not be using local mode, so nothing should actually change
    expect(foo.value).toBe('initial')

    await nextTick()
    expect(compRender).toBeCalledTimes(1)
    expect(updateFooBar).toBeCalledTimes(1)
    expect(updateFooBar).toHaveBeenCalledWith('bar')
    expect(foo.value).toBe('initial')
    expect(serializeInner(root)).toBe('initial')
  })

  test('kebab-case update listener (should not be local)', async () => {
    let foo: any

    const compRender = vi.fn()
    const Comp = defineComponent({
      props: ['fooBar'],
      emits: ['update:fooBar'],
      setup(props) {
        foo = useModel(props, 'fooBar')
        return () => {
          compRender()
          return foo.value
        }
      },
    })

    const updateFooBar = vi.fn()
    const root = nodeOps.createElement('div')
    // The template compiler won't create hyphenated listeners, but it could have been passed manually
    render(
      h(Comp, { 'foo-bar': 'initial', 'onUpdate:foo-bar': updateFooBar }),
      root,
    )
    expect(compRender).toBeCalledTimes(1)
    expect(serializeInner(root)).toBe('initial')

    expect(foo.value).toBe('initial')
    foo.value = 'bar'
    // should not be using local mode, so nothing should actually change
    expect(foo.value).toBe('initial')

    await nextTick()
    expect(compRender).toBeCalledTimes(1)
    expect(updateFooBar).toBeCalledTimes(1)
    expect(updateFooBar).toHaveBeenCalledWith('bar')
    expect(foo.value).toBe('initial')
    expect(serializeInner(root)).toBe('initial')
  })

  test('default value', async () => {
    let count: any
    const inc = () => {
      count.value++
    }

    const compRender = vi.fn()
    const Comp = defineComponent({
      props: { count: { default: 0 } },
      emits: ['update:count'],
      setup(props) {
        count = useModel(props, 'count')
        return () => {
          compRender()
          return count.value
        }
      },
    })

    const root = nodeOps.createElement('div')
    const updateCount = vi.fn()
    render(h(Comp, { 'onUpdate:count': updateCount }), root)
    expect(compRender).toBeCalledTimes(1)
    expect(serializeInner(root)).toBe('0')

    expect(count.value).toBe(0)

    inc()
    // when parent didn't provide value, local mutation is enabled
    expect(count.value).toBe(1)

    await nextTick()

    expect(updateCount).toBeCalledTimes(1)
    expect(compRender).toBeCalledTimes(2)
    expect(serializeInner(root)).toBe('1')
  })

  test('parent limiting child value', async () => {
    let childCount: Ref<number>

    const compRender = vi.fn()
    const Comp = defineComponent({
      props: ['count'],
      emits: ['update:count'],
      setup(props) {
        childCount = useModel(props, 'count')
        return () => {
          compRender()
          return childCount.value
        }
      },
    })

    const Parent = defineComponent({
      setup() {
        const count = ref(0)
        watch(count, () => {
          if (count.value < 0) {
            count.value = 0
          }
        })
        return () =>
          h(Comp, {
            count: count.value,
            'onUpdate:count': val => {
              count.value = val
            },
          })
      },
    })

    const root = nodeOps.createElement('div')
    render(h(Parent), root)
    expect(serializeInner(root)).toBe('0')

    // child update
    childCount!.value = 1
    // not yet updated
    expect(childCount!.value).toBe(0)

    await nextTick()
    expect(childCount!.value).toBe(1)
    expect(serializeInner(root)).toBe('1')

    // child update to invalid value
    childCount!.value = -1
    // not yet updated
    expect(childCount!.value).toBe(1)

    await nextTick()
    // limited to 0 by parent
    expect(childCount!.value).toBe(0)
    expect(serializeInner(root)).toBe('0')
  })

  test('has parent value -> no parent value', async () => {
    let childCount: Ref<number>

    const compRender = vi.fn()
    const Comp = defineComponent({
      props: ['count'],
      emits: ['update:count'],
      setup(props) {
        childCount = useModel(props, 'count')
        return () => {
          compRender()
          return childCount.value
        }
      },
    })

    const toggle = ref(true)
    const Parent = defineComponent({
      setup() {
        const count = ref(0)
        return () =>
          toggle.value
            ? h(Comp, {
                count: count.value,
                'onUpdate:count': val => {
                  count.value = val
                },
              })
            : h(Comp)
      },
    })

    const root = nodeOps.createElement('div')
    render(h(Parent), root)
    expect(serializeInner(root)).toBe('0')

    // child update
    childCount!.value = 1
    // not yet updated
    expect(childCount!.value).toBe(0)

    await nextTick()
    expect(childCount!.value).toBe(1)
    expect(serializeInner(root)).toBe('1')

    // parent change
    toggle.value = false

    await nextTick()
    // localValue should be reset
    expect(childCount!.value).toBeUndefined()
    expect(serializeInner(root)).toBe('<!---->')

    // child local mutation should continue to work
    childCount!.value = 2
    expect(childCount!.value).toBe(2)

    await nextTick()
    expect(serializeInner(root)).toBe('2')
  })

  // #9838
  test('pass modelValue to slot (optimized mode) ', async () => {
    let foo: any
    const update = () => {
      foo.value = 'bar'
    }

    const Comp = {
      render(this: any) {
        return this.$slots.default()
      },
    }

    const childRender = vi.fn()
    const slotRender = vi.fn()
    const Child = defineComponent({
      props: ['modelValue'],
      emits: ['update:modelValue'],
      setup(props) {
        foo = useModel(props, 'modelValue')
        return () => {
          childRender()
          return (
            openBlock(),
            createElementBlock(Fragment, null, [
              createVNode(Comp, null, {
                default: () => {
                  slotRender()
                  return createElementVNode('div', null, foo.value)
                },
                _: 1 /* STABLE */,
              }),
            ])
          )
        }
      },
    })

    const msg = ref('')
    const setValue = vi.fn(v => (msg.value = v))
    const root = nodeOps.createElement('div')
    createApp({
      render() {
        return (
          openBlock(),
          createBlock(
            Child,
            {
              modelValue: msg.value,
              'onUpdate:modelValue': setValue,
            },
            null,
            8 /* PROPS */,
            ['modelValue'],
          )
        )
      },
    }).mount(root)

    expect(foo.value).toBe('')
    expect(msg.value).toBe('')
    expect(setValue).not.toBeCalled()
    expect(childRender).toBeCalledTimes(1)
    expect(slotRender).toBeCalledTimes(1)
    expect(serializeInner(root)).toBe('<div></div>')

    // update from child
    update()

    await nextTick()
    expect(msg.value).toBe('bar')
    expect(foo.value).toBe('bar')
    expect(setValue).toBeCalledTimes(1)
    expect(childRender).toBeCalledTimes(2)
    expect(slotRender).toBeCalledTimes(2)
    expect(serializeInner(root)).toBe('<div>bar</div>')
  })

  test('with modifiers & transformers', async () => {
    let childMsg: Ref<string>
    let childModifiers: Record<string, true | undefined>

    const compRender = vi.fn()
    const Comp = defineComponent({
      props: ['msg', 'msgModifiers'],
      emits: ['update:msg'],
      setup(props) {
        ;[childMsg, childModifiers] = useModel(props, 'msg', {
          get(val) {
            return val.toLowerCase()
          },
          set(val) {
            if (childModifiers.upper) {
              return val.toUpperCase()
            }
          },
        })
        return () => {
          compRender()
          return childMsg.value
        }
      },
    })

    const msg = ref('HI')
    const Parent = defineComponent({
      setup() {
        return () =>
          h(Comp, {
            msg: msg.value,
            msgModifiers: { upper: true },
            'onUpdate:msg': val => {
              msg.value = val
            },
          })
      },
    })

    const root = nodeOps.createElement('div')
    render(h(Parent), root)

    // should be lowered
    expect(serializeInner(root)).toBe('hi')

    // child update
    childMsg!.value = 'Hmm'

    await nextTick()
    expect(childMsg!.value).toBe('hmm')
    expect(serializeInner(root)).toBe('hmm')
    // parent should get uppercase value
    expect(msg.value).toBe('HMM')

    // parent update
    msg.value = 'Ughh'
    await nextTick()
    expect(serializeInner(root)).toBe('ughh')
    expect(msg.value).toBe('Ughh')

    // child update again
    childMsg!.value = 'ughh'
    await nextTick()
    expect(msg.value).toBe('UGHH')
  })
})
