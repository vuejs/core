import {
  type InjectionKey,
  type Ref,
  defineComponent,
  h,
  hasInjectionContext,
  inject,
  nextTick,
  onBeforeUpdate,
  onMounted,
  provide,
  reactive,
  readonly,
  ref,
} from '../src/index'
import { createApp, nodeOps, render, serialize } from '@vue/runtime-test'

describe('api: provide/inject', () => {
  it('string keys', () => {
    const Provider = {
      setup() {
        provide('foo', 1)
        return () => h(Middle)
      },
    }

    const Middle = {
      render: () => h(Consumer),
    }

    const Consumer = {
      setup() {
        const foo = inject('foo')
        return () => foo
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Provider), root)
    expect(serialize(root)).toBe(`<div>1</div>`)
  })

  it('symbol keys', () => {
    // also verifies InjectionKey type sync
    const key: InjectionKey<number> = Symbol()

    const Provider = {
      setup() {
        provide(key, 1)
        return () => h(Middle)
      },
    }

    const Middle = {
      render: () => h(Consumer),
    }

    const Consumer = {
      setup() {
        const foo = inject(key) || 1
        return () => foo + 1
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Provider), root)
    expect(serialize(root)).toBe(`<div>2</div>`)
  })

  it('default values', () => {
    const Provider = {
      setup() {
        provide('foo', 'foo')
        return () => h(Middle)
      },
    }

    const Middle = {
      render: () => h(Consumer),
    }

    const Consumer = {
      setup() {
        // default value should be ignored if value is provided
        const foo = inject('foo', 'fooDefault')
        // default value should be used if value is not provided
        const bar = inject('bar', 'bar')
        return () => foo + bar
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Provider), root)
    expect(serialize(root)).toBe(`<div>foobar</div>`)
  })

  it('bound to instance', () => {
    const Provider = {
      setup() {
        return () => h(Consumer)
      },
    }

    const Consumer = defineComponent({
      name: 'Consumer',
      inject: {
        foo: {
          from: 'foo',
          default() {
            return this!.$options.name
          },
        },
      },
      render() {
        return this.foo
      },
    })

    const root = nodeOps.createElement('div')
    render(h(Provider), root)
    expect(serialize(root)).toBe(`<div>Consumer</div>`)
  })

  it('nested providers', () => {
    const ProviderOne = {
      setup() {
        provide('foo', 'foo')
        provide('bar', 'bar')
        return () => h(ProviderTwo)
      },
    }

    const ProviderTwo = {
      setup() {
        // override parent value
        provide('foo', 'fooOverride')
        provide('baz', 'baz')
        return () => h(Consumer)
      },
    }

    const Consumer = {
      setup() {
        const foo = inject('foo')
        const bar = inject('bar')
        const baz = inject('baz')
        return () => [foo, bar, baz].join(',')
      },
    }

    const root = nodeOps.createElement('div')
    render(h(ProviderOne), root)
    expect(serialize(root)).toBe(`<div>fooOverride,bar,baz</div>`)
  })

  it('reactivity with refs', async () => {
    const count = ref(1)

    const Provider = {
      setup() {
        provide('count', count)
        return () => h(Middle)
      },
    }

    const Middle = {
      render: () => h(Consumer),
    }

    const Consumer = {
      setup() {
        const count = inject<Ref<number>>('count')!
        return () => count.value
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Provider), root)
    expect(serialize(root)).toBe(`<div>1</div>`)

    count.value++
    await nextTick()
    expect(serialize(root)).toBe(`<div>2</div>`)
  })

  it('reactivity with readonly refs', async () => {
    const count = ref(1)

    const Provider = {
      setup() {
        provide('count', readonly(count))
        return () => h(Middle)
      },
    }

    const Middle = {
      render: () => h(Consumer),
    }

    const Consumer = {
      setup() {
        const count = inject<Ref<number>>('count')!
        // should not work
        count.value++
        return () => count.value
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Provider), root)
    expect(serialize(root)).toBe(`<div>1</div>`)

    expect(
      `Set operation on key "value" failed: target is readonly`,
    ).toHaveBeenWarned()

    // source mutation should still work
    count.value++
    await nextTick()
    expect(serialize(root)).toBe(`<div>2</div>`)
  })

  it('reactivity with objects', async () => {
    const rootState = reactive({ count: 1 })

    const Provider = {
      setup() {
        provide('state', rootState)
        return () => h(Middle)
      },
    }

    const Middle = {
      render: () => h(Consumer),
    }

    const Consumer = {
      setup() {
        const state = inject<typeof rootState>('state')!
        return () => state.count
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Provider), root)
    expect(serialize(root)).toBe(`<div>1</div>`)

    rootState.count++
    await nextTick()
    expect(serialize(root)).toBe(`<div>2</div>`)
  })

  it('reactivity with readonly objects', async () => {
    const rootState = reactive({ count: 1 })

    const Provider = {
      setup() {
        provide('state', readonly(rootState))
        return () => h(Middle)
      },
    }

    const Middle = {
      render: () => h(Consumer),
    }

    const Consumer = {
      setup() {
        const state = inject<typeof rootState>('state')!
        // should not work
        state.count++
        return () => state.count
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Provider), root)
    expect(serialize(root)).toBe(`<div>1</div>`)

    expect(
      `Set operation on key "count" failed: target is readonly`,
    ).toHaveBeenWarned()

    rootState.count++
    await nextTick()
    expect(serialize(root)).toBe(`<div>2</div>`)
  })

  it('should warn unfound', () => {
    const Provider = {
      setup() {
        return () => h(Middle)
      },
    }

    const Middle = {
      render: () => h(Consumer),
    }

    const Consumer = {
      setup() {
        const foo = inject('foo')
        expect(foo).toBeUndefined()
        return () => foo
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Provider), root)
    expect(serialize(root)).toBe(`<div><!----></div>`)
    expect(`injection "foo" not found.`).toHaveBeenWarned()
  })

  it('should not warn when default value is undefined', () => {
    const Provider = {
      setup() {
        return () => h(Middle)
      },
    }

    const Middle = {
      render: () => h(Consumer),
    }

    const Consumer = {
      setup() {
        const foo = inject('foo', undefined)
        return () => foo
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Provider), root)
    expect(`injection "foo" not found.`).not.toHaveBeenWarned()
  })

  // #2400
  it('should not self-inject', () => {
    const Comp = {
      setup() {
        provide('foo', 'foo')
        const injection = inject('foo', null)
        return () => injection
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serialize(root)).toBe(`<div><!----></div>`)
  })

  // #13921
  it('overlapping inheritance cycles', async () => {
    let shouldProvide = ref(false)

    const Comp4 = {
      props: ['data'],
      setup() {
        const data = ref('foo -1')

        onMounted(() => {
          data.value = inject('foo', 'foo 0')
        })

        onBeforeUpdate(() => {
          data.value = inject('foo', 'foo 0')
        })

        return () => [h('div', data.value)]
      },
    }

    const Comp3 = {
      props: ['data'],
      setup() {
        const data = ref('foo -1')

        onMounted(() => {
          data.value = inject('foo', 'foo 0')
        })

        onBeforeUpdate(() => {
          data.value = inject('foo', 'foo 0')
        })

        return () => [
          h('div', data.value),
          h(Comp4, { data: shouldProvide.value }),
        ]
      },
    }

    const Comp2 = {
      setup() {
        const data = ref('foo -1')

        onMounted(() => {
          data.value = inject('foo', 'foo 0')
        })

        onBeforeUpdate(() => {
          if (shouldProvide.value) {
            provide('foo', 'foo 2')
          }

          data.value = inject('foo', 'foo 0')
        })

        return () => [
          h('div', data.value),
          h(Comp3, { data: shouldProvide.value }),
        ]
      },
    }

    const Comp1 = {
      setup() {
        provide('foo', 'foo 1')
        const data = ref('foo -1')

        onMounted(() => {
          data.value = inject('foo', 'foo 0')
        })

        onBeforeUpdate(() => {
          data.value = inject('foo', 'foo 0')
        })

        return () => [h('div', data.value), h(Comp2)]
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Comp1), root)

    shouldProvide.value = true
    await nextTick()

    /*
      First (Root Component) should be "foo 0" because it is the Root Component and provdes shall only be injected to Descandents.
      Second (Component 2) should be "foo 1" because it should inherit the provide from the Root Component
      Third (Component 3) should be "foo 2" because it should inherit the provide from Component 2 (in the second render when shouldProvide = true)
      Fourth (Component 4) should also be "foo 2" because it should inherit the provide from Component 3 which should inherit it from Component 2 (in the second render when shouldProvide = true)
    */
    expect(serialize(root)).toBe(
      `<div><div>foo 0</div><div>foo 1</div><div>foo 2</div><div>foo 2</div></div>`,
    )
  })

  describe('hasInjectionContext', () => {
    it('should be false outside of setup', () => {
      expect(hasInjectionContext()).toBe(false)
    })

    it('should be true within setup', () => {
      expect.assertions(1)
      const Comp = {
        setup() {
          expect(hasInjectionContext()).toBe(true)
          return () => null
        },
      }

      const root = nodeOps.createElement('div')
      render(h(Comp), root)
    })

    it('should be true within app.runWithContext()', () => {
      expect.assertions(1)
      createApp({}).runWithContext(() => {
        expect(hasInjectionContext()).toBe(true)
      })
    })
  })
})
