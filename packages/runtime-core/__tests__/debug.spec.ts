import {debug} from '../src/debug'
import {
  h,
  render,
  defineComponent,
  ref, getCurrentInstance, ComponentInternalInstance, nodeOps,
  serializeInner as inner
} from '@vue/runtime-test'

describe('debug', () => {
  test('watching states', () => {
    const root = nodeOps.createElement('div')
    let instance: ComponentInternalInstance
    const Comp = defineComponent({
      setup() {
        const name = ref('foo')
        debug({
          name,
        })
        return () => (
          h('div', name.value)
        )
      },
      mounted() {
        instance = getCurrentInstance()!
      },
    })
    render(h(Comp), root)
    expect(inner(root)).toBe('<div>foo</div>')
    expect(instance!.setupState).toEqual({
      name: 'foo',
    })
  })
  test('watching states with calling the debug function multiple times', () => {
    const root = nodeOps.createElement('div')
    let instance: ComponentInternalInstance
    const Comp = defineComponent({
      setup() {
        const name = ref('foo')
        const age = ref(100)
        debug({
          name,
        })
        debug({
          age,
          name,
        })
        debug({
          name,
        })
        return () => (
          h('div', name.value)
        )
      },
      mounted() {
        instance = getCurrentInstance()!
      },
    })
    render(h(Comp), root)
    expect(inner(root)).toBe('<div>foo</div>')
    expect(instance!.setupState).toEqual({
      name: 'foo',
      age: 100,
    })
  })
})
