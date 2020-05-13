import { ref, reactive } from '@vue/reactivity'
import {
  renderToString,
  h,
  nodeOps,
  render,
  serializeInner,
  nextTick,
  watchEffect,
  defineComponent,
  triggerEvent,
  TestElement
} from '@vue/runtime-test'

// reference: https://vue-composition-api-rfc.netlify.com/api.html#setup

describe('api: setup context', () => {
  it('should expose return values to template render context', () => {
    const Comp = defineComponent({
      setup() {
        return {
          // ref should auto-unwrap
          ref: ref('foo'),
          // object exposed as-is
          object: reactive({ msg: 'bar' }),
          // primitive value exposed as-is
          value: 'baz'
        }
      },
      render() {
        return `${this.ref} ${this.object.msg} ${this.value}`
      }
    })
    expect(renderToString(h(Comp))).toMatch(`foo bar baz`)
  })

  it('should support returning render function', () => {
    const Comp = {
      setup() {
        return () => {
          return h('div', 'hello')
        }
      }
    }
    expect(renderToString(h(Comp))).toMatch(`hello`)
  })

  it('props', async () => {
    const count = ref(0)
    let dummy

    const Parent = {
      render: () => h(Child, { count: count.value })
    }

    const Child = defineComponent({
      props: { count: Number },
      setup(props) {
        watchEffect(() => {
          dummy = props.count
        })
        return () => h('div', props.count)
      }
    })

    const root = nodeOps.createElement('div')
    render(h(Parent), root)
    expect(serializeInner(root)).toMatch(`<div>0</div>`)
    expect(dummy).toBe(0)

    // props should be reactive
    count.value++
    await nextTick()
    expect(serializeInner(root)).toMatch(`<div>1</div>`)
    expect(dummy).toBe(1)
  })

  it('setup props should resolve the correct types from props object', async () => {
    const count = ref(0)
    let dummy

    const Parent = {
      render: () => h(Child, { count: count.value })
    }

    const Child = defineComponent({
      props: {
        count: Number
      },

      setup(props) {
        watchEffect(() => {
          dummy = props.count
        })
        return () => h('div', props.count)
      }
    })

    const root = nodeOps.createElement('div')
    render(h(Parent), root)
    expect(serializeInner(root)).toMatch(`<div>0</div>`)
    expect(dummy).toBe(0)

    // props should be reactive
    count.value++
    await nextTick()
    expect(serializeInner(root)).toMatch(`<div>1</div>`)
    expect(dummy).toBe(1)
  })

  it('context.attrs', async () => {
    const toggle = ref(true)

    const Parent = {
      render: () => h(Child, toggle.value ? { id: 'foo' } : { class: 'baz' })
    }

    const Child = {
      // explicit empty props declaration
      // puts everything received in attrs
      // disable implicit fallthrough
      inheritAttrs: false,
      setup(props: any, { attrs }: any) {
        return () => h('div', attrs)
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Parent), root)
    expect(serializeInner(root)).toMatch(`<div id="foo"></div>`)

    // should update even though it's not reactive
    toggle.value = false
    await nextTick()
    expect(serializeInner(root)).toMatch(`<div class="baz"></div>`)
  })

  it('context.slots', async () => {
    const id = ref('foo')

    const Parent = {
      render: () =>
        h(Child, null, {
          foo: () => id.value,
          bar: () => 'bar'
        })
    }

    const Child = {
      setup(props: any, { slots }: any) {
        return () => h('div', [...slots.foo(), ...slots.bar()])
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Parent), root)
    expect(serializeInner(root)).toMatch(`<div>foobar</div>`)

    // should update even though it's not reactive
    id.value = 'baz'
    await nextTick()
    expect(serializeInner(root)).toMatch(`<div>bazbar</div>`)
  })

  it('context.emit', async () => {
    const count = ref(0)
    const spy = jest.fn()

    const Parent = {
      render: () =>
        h(Child, {
          count: count.value,
          onInc: (newVal: number) => {
            spy()
            count.value = newVal
          }
        })
    }

    const Child = defineComponent({
      props: {
        count: {
          type: Number,
          default: 1
        }
      },
      setup(props, { emit }) {
        return () =>
          h(
            'div',
            {
              onClick: () => emit('inc', props.count + 1)
            },
            props.count
          )
      }
    })

    const root = nodeOps.createElement('div')
    render(h(Parent), root)
    expect(serializeInner(root)).toMatch(`<div>0</div>`)

    // emit should trigger parent handler
    triggerEvent(root.children[0] as TestElement, 'click')
    expect(spy).toHaveBeenCalled()
    await nextTick()
    expect(serializeInner(root)).toMatch(`<div>1</div>`)
  })
})
