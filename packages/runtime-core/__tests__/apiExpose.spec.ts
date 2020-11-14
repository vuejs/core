import { nodeOps, render } from '@vue/runtime-test'
import { defineComponent, h, ref } from '../src'

describe('api: expose', () => {
  test('via setup context', () => {
    const Child = defineComponent({
      render() {},
      setup(_, { expose }) {
        expose({
          foo: ref(1),
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
})
