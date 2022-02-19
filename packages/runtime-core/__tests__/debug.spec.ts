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
})
