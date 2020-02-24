import {
  h,
  ref,
  render,
  nodeOps,
  nextTick,
  defineComponent,
  serializeInner as inner
} from '@vue/runtime-test'

describe('renderer: component', () => {
  it('should render basic component', () => {
    const Component = {
      setup() {
        const foo = ref('foo')
        return () => h('div', foo.value)
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Component), root)
    expect(inner(root)).toBe('<div>foo</div>')
  })

  it('should update component', async () => {
    const foo = ref('foo')

    const Component = {
      setup() {
        return () => h('div', foo.value)
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Component), root)
    expect(inner(root)).toBe('<div>foo</div>')

    foo.value = 'bar'
    await nextTick()
    expect(inner(root)).toBe('<div>bar</div>')
  })

  it('should work component props', async () => {
    const foo = ref('foo')

    const Child = defineComponent({
      props: {
        foo: {
          type: String,
          required: true
        }
      },
      setup(props) {
        return () => h('div', props.foo)
      }
    })
    const Parent = defineComponent({
      setup() {
        return () => h(Child, { foo: foo.value })
      }
    })

    const root = nodeOps.createElement('div')
    render(h(Parent), root)
    expect(inner(root)).toBe('<div>foo</div>')

    foo.value = 'bar'
    await nextTick()
    expect(inner(root)).toBe('<div>bar</div>')
  })

  describe('slots', () => {
    test('should respect $stable flag', async () => {
      const flag1 = ref(1)
      const flag2 = ref(2)
      const spy = jest.fn()

      const Child = () => {
        spy()
        return 'child'
      }

      const App = {
        setup() {
          return () => [
            flag1.value,
            h(
              Child,
              { n: flag2.value },
              {
                foo: () => 'foo',
                $stable: true
              }
            )
          ]
        }
      }

      render(h(App), nodeOps.createElement('div'))
      expect(spy).toHaveBeenCalledTimes(1)

      // parent re-render, props didn't change, slots are stable
      // -> child should not update
      flag1.value++
      await nextTick()
      expect(spy).toHaveBeenCalledTimes(1)

      // parent re-render, props changed
      // -> child should update
      flag2.value++
      await nextTick()
      expect(spy).toHaveBeenCalledTimes(2)
    })
  })

  test('emit', async () => {
    let noMatchEmitResult: any
    let singleEmitResult: any
    let multiEmitResult: any

    const Child = defineComponent({
      setup(_, { emit }) {
        noMatchEmitResult = emit('foo')
        singleEmitResult = emit('bar')
        multiEmitResult = emit('baz')
        return () => h('div')
      }
    })

    const App = {
      setup() {
        return () =>
          h(Child, {
            // emit triggering single handler
            onBar: () => 1,
            // emit triggering multiple handlers
            onBaz: [() => Promise.resolve(2), () => Promise.resolve(3)]
          })
      }
    }

    render(h(App), nodeOps.createElement('div'))

    // assert return values from emit
    expect(noMatchEmitResult).toMatchObject([])
    expect(singleEmitResult).toMatchObject([1])
    expect(await Promise.all(multiEmitResult)).toMatchObject([2, 3])
  })

  // for v-model:foo-bar usage in DOM templates
  test('emit update:xxx events should trigger kebab-case equivalent', () => {
    const Child = defineComponent({
      setup(_, { emit }) {
        emit('update:fooBar', 1)
        return () => h('div')
      }
    })

    const handler = jest.fn()
    const App = {
      setup() {
        return () =>
          h(Child, {
            'onUpdate:foo-bar': handler
          })
      }
    }

    render(h(App), nodeOps.createElement('div'))
    expect(handler).toHaveBeenCalled()
  })
})
