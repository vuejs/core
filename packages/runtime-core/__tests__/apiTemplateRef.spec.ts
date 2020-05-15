import {
  ref,
  nodeOps,
  h,
  render,
  nextTick,
  defineComponent,
  reactive
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
    const fn = jest.fn()

    const Comp = defineComponent(() => () => h('div', { ref: fn }))
    render(h(Comp), root)
    expect(fn.mock.calls[0][0]).toBe(root.children[0])
  })

  it('function ref update', async () => {
    const root = nodeOps.createElement('div')
    const fn1 = jest.fn()
    const fn2 = jest.fn()
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
    const fn = jest.fn()
    const toggle = ref(true)

    const Comp = defineComponent(() => () =>
      toggle.value ? h('div', { ref: fn }) : null
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
    const spy = jest.fn()
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
})
