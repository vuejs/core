import { createApp, nodeOps, render } from '@vue/runtime-test'
import { defineComponent, h, ref } from '../src'

describe('api: expose', () => {
  test('via setup context', () => {
    const Child = defineComponent({
      render() {},
      setup(_, { expose }) {
        expose({
          foo: 1,
          bar: ref(2)
        })
        return {
          bar: ref(3),
          baz: ref(4)
        }
      }
    })

    const childRef = ref()
    const Parent = {
      setup() {
        return () => h(Child, { ref: childRef })
      }
    }
    const root = nodeOps.createElement('div')
    render(h(Parent), root)
    expect(childRef.value).toBeTruthy()
    expect(childRef.value.foo).toBe(1)
    expect(childRef.value.bar).toBe(2)
    expect(childRef.value.baz).toBeUndefined()
  })

  test('via options', () => {
    const Child = defineComponent({
      render() {},
      data() {
        return {
          foo: 1
        }
      },
      setup() {
        return {
          bar: ref(2),
          baz: ref(3)
        }
      },
      expose: ['foo', 'bar']
    })

    const childRef = ref()
    const Parent = {
      setup() {
        return () => h(Child, { ref: childRef })
      }
    }
    const root = nodeOps.createElement('div')
    render(h(Parent), root)
    expect(childRef.value).toBeTruthy()
    expect(childRef.value.foo).toBe(1)
    expect(childRef.value.bar).toBe(2)
    expect(childRef.value.baz).toBeUndefined()
  })

  test('options + context', () => {
    const Child = defineComponent({
      render() {},
      expose: ['foo'],
      data() {
        return {
          foo: 1
        }
      },
      setup(_, { expose }) {
        expose({
          bar: ref(2)
        })
        return {
          bar: ref(3),
          baz: ref(4)
        }
      }
    })

    const childRef = ref()
    const Parent = {
      setup() {
        return () => h(Child, { ref: childRef })
      }
    }
    const root = nodeOps.createElement('div')
    render(h(Parent), root)
    expect(childRef.value).toBeTruthy()
    expect(childRef.value.foo).toBe(1)
    expect(childRef.value.bar).toBe(2)
    expect(childRef.value.baz).toBeUndefined()
  })

  test('options: empty', () => {
    const Child = defineComponent({
      render() {},
      expose: [],
      data() {
        return {
          foo: 1
        }
      }
    })

    const childRef = ref()
    const Parent = {
      setup() {
        return () => h(Child, { ref: childRef })
      }
    }
    const root = nodeOps.createElement('div')
    render(h(Parent), root)
    expect(childRef.value).toBeTruthy()
    expect('foo' in childRef.value).toBe(false)
  })

  test('options: empty + setup context', () => {
    const Child = defineComponent({
      render() {},
      expose: [],
      setup(_, { expose }) {
        expose({
          foo: 1
        })
      }
    })

    const childRef = ref()
    const Parent = {
      setup() {
        return () => h(Child, { ref: childRef })
      }
    }
    const root = nodeOps.createElement('div')
    render(h(Parent), root)
    expect(childRef.value).toBeTruthy()
    expect(childRef.value.foo).toBe(1)
  })

  test('with $parent/$root', () => {
    const Child = defineComponent({
      render() {
        expect((this.$parent! as any).foo).toBe(1)
        expect((this.$parent! as any).bar).toBe(undefined)
        expect((this.$root! as any).foo).toBe(1)
        expect((this.$root! as any).bar).toBe(undefined)
      }
    })

    const Parent = defineComponent({
      expose: [],
      setup(_, { expose }) {
        expose({
          foo: 1
        })
        return {
          bar: 2
        }
      },
      render() {
        return h(Child)
      }
    })
    const root = nodeOps.createElement('div')
    render(h(Parent), root)
  })

  test('with mount', () => {
    const Component = defineComponent({
      setup(_, { expose }) {
        expose({
          foo: 1
        })
        return {
          bar: 2
        }
      },
      render() {
        return h('div')
      }
    })
    const root = nodeOps.createElement('div')
    const vm = createApp(Component).mount(root) as any
    expect(vm.foo).toBe(1)
    expect(vm.bar).toBe(undefined)
  })

  test('expose should allow access to built-in instance properties', () => {
    const GrandChild = defineComponent({
      render() {
        return h('div')
      }
    })

    const grandChildRef = ref()
    const Child = defineComponent({
      render() {
        return h('div')
      },
      setup(_, { expose }) {
        expose({
          foo: 42
        })
        return () => h(GrandChild, { ref: grandChildRef })
      }
    })

    const childRef = ref()
    const Parent = {
      setup() {
        return () => h(Child, { ref: childRef })
      }
    }
    const root = nodeOps.createElement('div')
    render(h(Parent), root)
    expect('$el' in childRef.value).toBe(true)
    expect(childRef.value.$el.tag).toBe('div')
    expect('foo' in childRef.value).toBe(true)
    expect('$parent' in grandChildRef.value).toBe(true)
    expect(grandChildRef.value.$parent).toBe(childRef.value)
    expect(grandChildRef.value.$parent.$parent).toBe(grandChildRef.value.$root)
  })
})
