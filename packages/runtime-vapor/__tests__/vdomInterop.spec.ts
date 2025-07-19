import {
  createVNode,
  defineComponent,
  h,
  nextTick,
  ref,
  renderSlot,
  toDisplayString,
  useModel,
} from '@vue/runtime-dom'
import { makeInteropRender } from './_utils'
import {
  applyTextModel,
  child,
  createComponent,
  createDynamicComponent,
  defineVaporComponent,
  renderEffect,
  setText,
  template,
} from '../src'

const { define, defineVapor } = makeInteropRender()

describe('vdomInterop', () => {
  describe('props', () => {
    test('should work if props are not provided', () => {
      const VaporChild = defineVaporComponent({
        props: {
          msg: String,
        },
        setup(_, { attrs }) {
          return [document.createTextNode(attrs.class || 'foo')]
        },
      })

      const { html } = define({
        setup() {
          return () => h(VaporChild as any)
        },
      }).render()

      expect(html()).toBe('foo')
    })
  })

  describe('v-model', () => {
    test('basic work', async () => {
      const VaporChild = defineVaporComponent({
        props: {
          modelValue: {},
          modelModifiers: {},
        },
        emits: ['update:modelValue'],
        setup(__props) {
          const modelValue = useModel(__props, 'modelValue')

          const n0 = template('<h1> </h1>')() as any
          const n1 = template('<input>')() as any
          const x0 = child(n0) as any
          applyTextModel(
            n1,
            () => modelValue.value,
            _value => (modelValue.value = _value),
          )
          renderEffect(() => setText(x0, toDisplayString(modelValue.value)))
          return [n0, n1]
        },
      })

      const { html, host } = define({
        setup() {
          const msg = ref('foo')
          return () =>
            h(VaporChild as any, {
              modelValue: msg.value,
              'onUpdate:modelValue': (value: string) => {
                msg.value = value
              },
            })
        },
      }).render()

      expect(html()).toBe('<h1>foo</h1><input>')

      const inputEl = host.querySelector('input')!
      inputEl.value = 'bar'
      inputEl.dispatchEvent(new Event('input'))

      await nextTick()
      expect(html()).toBe('<h1>bar</h1><input>')
    })
  })

  describe('emit', () => {
    test('emit from vapor child to vdom parent', () => {
      const VaporChild = defineVaporComponent({
        emits: ['click'],
        setup(_, { emit }) {
          emit('click')
          return []
        },
      })

      const fn = vi.fn()
      define({
        setup() {
          return () => h(VaporChild as any, { onClick: fn })
        },
      }).render()

      // fn should be called once
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe('slots', () => {
    test('basic', () => {
      const VDomChild = defineComponent({
        setup(_, { slots }) {
          return () => renderSlot(slots, 'default')
        },
      })

      const VaporChild = defineVaporComponent({
        setup() {
          return createComponent(
            VDomChild as any,
            null,
            {
              default: () => document.createTextNode('default slot'),
            },
            true,
          )
        },
      })

      const { html } = define({
        setup() {
          return () => h(VaporChild as any)
        },
      }).render()

      expect(html()).toBe('default slot')
    })

    test('functional slot', () => {
      const VDomChild = defineComponent({
        setup(_, { slots }) {
          return () => createVNode(slots.default!)
        },
      })

      const VaporChild = defineVaporComponent({
        setup() {
          return createComponent(
            VDomChild as any,
            null,
            {
              default: () => document.createTextNode('default slot'),
            },
            true,
          )
        },
      })

      const { html } = define({
        setup() {
          return () => h(VaporChild as any)
        },
      }).render()

      expect(html()).toBe('default slot')
    })
  })

  describe.todo('provide', () => {})

  describe.todo('inject', () => {})

  describe.todo('template ref', () => {})

  describe('dynamic component', () => {
    it('should not render to Virtual DOM', () => {
      const VaporChild = defineVaporComponent({
        setup() {
          return createDynamicComponent(
            () => () => document.createTextNode('foo'),
          )
        },
      })

      const { host } = defineVapor(VaporChild).render()

      expect(host.innerHTML).toMatchInlineSnapshot(
        `"foo<!--dynamic-component-->"`,
      )
    })
  })

  describe('attribute fallthrough', () => {
    it('should not fallthrough emit handlers to vdom child', () => {
      const VDomChild = defineComponent({
        emits: ['click'],
        setup(_, { emit }) {
          return () => h('button', { onClick: () => emit('click') }, 'click me')
        },
      })

      const fn = vi.fn()
      const VaporChild = defineVaporComponent({
        emits: ['click'],
        setup() {
          return createComponent(
            VDomChild as any,
            { onClick: () => fn },
            null,
            true,
          )
        },
      })

      const { host, html } = define({
        setup() {
          return () => h(VaporChild as any)
        },
      }).render()

      expect(html()).toBe('<button>click me</button>')
      const button = host.querySelector('button')!
      button.dispatchEvent(new Event('click'))

      // fn should be called once
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })
})
