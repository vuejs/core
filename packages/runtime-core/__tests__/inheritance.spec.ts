import {
  Component,
  observable,
  h,
  nextTick,
  KeepAlive,
  ComponentPropsOptions,
  ComponentWatchOptions
} from '@vue/runtime-core'
import { createInstance, renderInstance } from '@vue/runtime-test'

describe('class inheritance', () => {
  it('should merge data', () => {
    class Base extends Component {
      foo = 1
      data() {
        return {
          bar: 2
        }
      }
    }

    class Child extends Base {
      foo: number
      bar: number
      baz: number
      qux: number = 4

      data(): any {
        return {
          baz: 3
        }
      }
    }

    const child = createInstance(Child)

    expect(child.foo).toBe(1)
    expect(child.bar).toBe(2)
    expect(child.baz).toBe(3)
    expect(child.qux).toBe(4)
  })

  it('should merge props', () => {
    class Base extends Component {
      static props: ComponentPropsOptions = {
        foo: Number
      }
    }

    class Child extends Base {
      foo: number
      bar: number
      $props: { foo: number; bar: number }
      static props: ComponentPropsOptions = {
        bar: Number
      }
    }

    const child = createInstance(Child, {
      foo: 1,
      bar: 2
    })

    expect(child.foo).toBe(1)
    expect(child.bar).toBe(2)
    expect(child.$props.foo).toBe(1)
    expect(child.$props.bar).toBe(2)
  })

  it('should merge lifecycle hooks', async () => {
    const calls: string[] = []
    const state = observable({ ok: true })

    class Base extends Component {
      beforeCreate() {
        calls.push('base beforeCreate')
      }
      created() {
        calls.push('base created')
      }
      beforeMount() {
        calls.push('base beforeMount')
      }
      mounted() {
        calls.push('base mounted')
      }
      beforeUpdate() {
        calls.push('base beforeUpdate')
      }
      updated() {
        calls.push('base updated')
      }
      beforeUnmount() {
        calls.push('base beforeUnmount')
      }
      unmounted() {
        calls.push('base unmounted')
      }
    }

    class Child extends Base {
      beforeCreate() {
        calls.push('child beforeCreate')
      }
      created() {
        calls.push('child created')
      }
      beforeMount() {
        calls.push('child beforeMount')
      }
      mounted() {
        calls.push('child mounted')
      }
      beforeUpdate() {
        calls.push('child beforeUpdate')
      }
      updated() {
        calls.push('child updated')
      }
      beforeUnmount() {
        calls.push('child beforeUnmount')
      }
      unmounted() {
        calls.push('child unmounted')
      }
      render() {
        return state.ok ? 'foo' : 'bar'
      }
    }

    class Container extends Component {
      show = true
      render() {
        return this.show ? h(Child) : null
      }
    }

    const container = await renderInstance(Container)
    expect(calls).toEqual([
      'base beforeCreate',
      'child beforeCreate',
      'base created',
      'child created',
      'base beforeMount',
      'child beforeMount',
      'base mounted',
      'child mounted'
    ])

    calls.length = 0
    state.ok = false
    await nextTick()
    expect(calls).toEqual([
      'base beforeUpdate',
      'child beforeUpdate',
      'base updated',
      'child updated'
    ])

    calls.length = 0
    container.show = false
    await nextTick()
    expect(calls).toEqual([
      'base beforeUnmount',
      'child beforeUnmount',
      'base unmounted',
      'child unmounted'
    ])
  })

  it('should merge lifecycle hooks (activated/deactivated)', async () => {
    const calls: string[] = []

    class Base extends Component {
      activated() {
        calls.push('base activated')
      }
      deactivated() {
        calls.push('base deactivated')
      }
    }

    class Child extends Base {
      activated() {
        calls.push('child activated')
      }
      deactivated() {
        calls.push('child deactivated')
      }
      render() {
        return 'foo'
      }
    }

    class Container extends Component {
      ok = true
      render() {
        return h(KeepAlive, this.ok ? h(Child) : null)
      }
    }

    const container = await renderInstance(Container)
    expect(container.$el.text).toBe('foo')

    container.ok = false
    await nextTick()
    expect(container.$el.text).toBe('')
    expect(calls).toEqual(['base deactivated', 'child deactivated'])

    calls.length = 0
    container.ok = true
    await nextTick()
    expect(container.$el.text).toBe('foo')
    expect(calls).toEqual(['base activated', 'child activated'])
  })

  it('should merge watchers', async () => {
    const fooCallback = jest.fn()
    const barCallback = jest.fn()

    class Base extends Component {
      static watch: ComponentWatchOptions = {
        foo: fooCallback
      }
    }

    class Child extends Base {
      foo = 1
      bar = 2
      static watch: ComponentWatchOptions = {
        bar: barCallback
      }
    }

    const child = createInstance(Child)
    child.foo = 2
    await nextTick()
    expect(fooCallback).toHaveBeenCalledWith(2, 1)
    child.bar = 3
    await nextTick()
    expect(barCallback).toHaveBeenCalledWith(3, 2)
  })

  it('should inherit methods', () => {
    const fooCallback = jest.fn()
    const barCallback = jest.fn()

    class Base extends Component {
      foo() {
        fooCallback()
      }
    }

    class Child extends Base {
      bar() {
        barCallback()
      }
    }

    const child = createInstance(Child)
    child.foo()
    child.bar()
    expect(fooCallback).toHaveBeenCalled()
    expect(barCallback).toHaveBeenCalled()
  })

  it('should inherit computed properties', () => {
    class Base extends Component {
      a = 1
      get foo() {
        return this.a + 1
      }
    }

    class Child extends Base {
      b = 1
      get bar() {
        return this.b + this.foo + 1
      }
    }

    const child = createInstance(Child)
    expect(child.foo).toBe(2)
    expect(child.bar).toBe(4)

    child.a = 2
    expect(child.foo).toBe(3)
    expect(child.bar).toBe(5)
  })
})
