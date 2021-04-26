import {
  h,
  nodeOps,
  render,
  serializeInner,
  triggerEvent,
  TestElement,
  nextTick,
  ref,
  defineComponent,
  ComponentOptionClass
} from '@vue/runtime-test'

describe('api: VCA class', () => {
  test('data', async () => {
    const CXXX = class extends ComponentOptionClass {
      setup() {
        const foo = ref(1)
        return () =>
          h(
            'div',
            {
              onClick: () => {
                foo.value++
              }
            },
            foo.value
          )
      }
    }
    const Comp = defineComponent(CXXX)
    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>1</div>`)

    triggerEvent(root.children[0] as TestElement, 'click')
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>2</div>`)
  })
})
