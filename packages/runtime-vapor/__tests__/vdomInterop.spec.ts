import {
  KeepAlive,
  type ShallowRef,
  createApp,
  createVNode,
  defineComponent,
  h,
  inject,
  nextTick,
  onActivated,
  onBeforeMount,
  onDeactivated,
  onMounted,
  onUnmounted,
  provide,
  ref,
  renderSlot,
  resolveDynamicComponent,
  shallowRef,
  toDisplayString,
  useModel,
  useTemplateRef,
  vShow,
  withDirectives,
} from '@vue/runtime-dom'
import { makeInteropRender } from './_utils'
import {
  VaporKeepAlive,
  applyTextModel,
  applyVShow,
  child,
  createComponent,
  createDynamicComponent,
  createSlot,
  defineVaporAsyncComponent,
  defineVaporComponent,
  renderEffect,
  setText,
  template,
  vaporInteropPlugin,
} from '../src'

const define = makeInteropRender()

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

    test('should handle class prop when vapor renders vdom component', () => {
      const VDomChild = defineComponent({
        setup() {
          return () => h('div', { class: 'foo' })
        },
      })

      const VaporChild = defineVaporComponent({
        setup() {
          return createComponent(VDomChild as any, { class: () => 'bar' })
        },
      })

      const { html } = define({
        setup() {
          return () => h(VaporChild as any)
        },
      }).render()

      expect(html()).toBe('<div class="foo bar"></div>')
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

    test('slot v-model should persist when switching vapor/vdom child', async () => {
      const VaporComp1 = defineVaporComponent({
        name: 'VaporComp1',
        setup() {
          return [document.createTextNode('comp1: '), createSlot('default')]
        },
      })

      const VDomComp2 = defineComponent({
        name: 'VDomComp2',
        setup(_, { slots }) {
          return () =>
            h('div', [
              'comp2: ',
              // vdom <slot/>
              renderSlot(slots, 'default'),
            ])
        },
      })

      const VaporParent = defineVaporComponent({
        name: 'VaporParent',
        props: {
          show: Boolean,
          modelValue: {},
          modelModifiers: {},
        },
        emits: ['update:modelValue'],
        setup(__props) {
          const modelValue = useModel(__props, 'modelValue')
          return createDynamicComponent(
            () => (__props.show ? VaporComp1 : VDomComp2),
            null,
            {
              default: () => {
                const input = template('<input>')() as any
                applyTextModel(
                  input,
                  () => modelValue.value,
                  _value => (modelValue.value = _value),
                )
                return input
              },
            },
            true,
          )
        },
      })

      const show = ref(true)
      const msg = ref('')

      const { host } = define({
        setup() {
          return () =>
            h(VaporParent as any, {
              show: show.value,
              modelValue: msg.value,
              'onUpdate:modelValue': (value: string) => {
                msg.value = value
              },
            })
        },
      }).render()

      const input1 = host.querySelector('input')!
      input1.value = 'hello'
      input1.dispatchEvent(new Event('input'))
      await nextTick()
      expect(msg.value).toBe('hello')

      show.value = false
      await nextTick()

      const input2 = host.querySelector('input')!
      expect(input2.value).toBe('hello')
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

  describe('directives', () => {
    test('apply v-show to vdom child', async () => {
      const VDomChild = {
        setup() {
          return () => h('div')
        },
      }

      const show = ref(false)
      const VaporChild = defineVaporComponent({
        setup() {
          const n1 = createComponent(VDomChild as any)
          applyVShow(n1, () => show.value)
          return n1
        },
      })

      const { html } = define({
        setup() {
          return () => h(VaporChild as any)
        },
      }).render()

      expect(html()).toBe('<div style="display: none;"></div>')

      show.value = true
      await nextTick()
      expect(html()).toBe('<div style=""></div>')
    })

    test('apply v-show to vapor child', async () => {
      const VaporChild = defineVaporComponent({
        setup() {
          return template('<div></div>', true)()
        },
      })

      const show = ref(false)
      const App = defineComponent({
        setup() {
          return () =>
            h('div', null, [
              withDirectives(h(VaporChild as any), [[vShow, show.value]]),
            ])
        },
      })

      const root = document.createElement('div')
      const app = createApp(App)
      app.use(vaporInteropPlugin)
      app.mount(root)

      expect(root.innerHTML).toBe(
        '<div><div style="display: none;"></div></div>',
      )

      show.value = true
      await nextTick()
      expect(root.innerHTML).toBe('<div><div style=""></div></div>')
    })

    test('apply custom directive to vapor child', async () => {
      const vCustom = {
        created: vi.fn(),
        beforeMount: vi.fn(),
        mounted: vi.fn(),
        beforeUpdate: vi.fn(),
        updated: vi.fn(),
        beforeUnmount: vi.fn(),
        unmounted: vi.fn(),
      }

      const VaporChild = defineVaporComponent({
        setup() {
          return template('<div></div>', true)()
        },
      })

      const count = ref(0)
      const App = defineComponent({
        setup() {
          return () =>
            h('div', null, [
              withDirectives(h(VaporChild as any), [[vCustom, count.value]]),
            ])
        },
      })

      const root = document.createElement('div')
      const app = createApp(App)
      app.use(vaporInteropPlugin)
      app.mount(root)

      // root > div (App root) > div (VaporChild root)
      const el = root.querySelector('div')!.querySelector('div')!
      expect(vCustom.created).toHaveBeenCalledTimes(1)
      expect(vCustom.beforeMount).toHaveBeenCalledTimes(1)
      expect(vCustom.mounted).toHaveBeenCalledTimes(1)
      expect(vCustom.beforeUpdate).toHaveBeenCalledTimes(0)
      expect(vCustom.updated).toHaveBeenCalledTimes(0)

      expect(vCustom.created).toHaveBeenCalledWith(
        el,
        expect.objectContaining({ value: 0, oldValue: undefined }),
        expect.any(Object),
        null,
      )
      expect(vCustom.beforeMount).toHaveBeenCalledWith(
        el,
        expect.objectContaining({ value: 0, oldValue: undefined }),
        expect.any(Object),
        null,
      )
      expect(vCustom.mounted).toHaveBeenCalledWith(
        el,
        expect.objectContaining({ value: 0, oldValue: undefined }),
        expect.any(Object),
        null,
      )

      count.value++
      await nextTick()
      expect(vCustom.beforeUpdate).toHaveBeenCalledTimes(1)
      expect(vCustom.updated).toHaveBeenCalledTimes(1)

      expect(vCustom.beforeUpdate).toHaveBeenCalledWith(
        el,
        expect.objectContaining({ value: 1, oldValue: 0 }),
        expect.any(Object),
        expect.any(Object),
      )
      expect(vCustom.updated).toHaveBeenCalledWith(
        el,
        expect.objectContaining({ value: 1, oldValue: 0 }),
        expect.any(Object),
        expect.any(Object),
      )

      app.unmount()
      expect(vCustom.beforeUnmount).toHaveBeenCalledTimes(1)
      expect(vCustom.unmounted).toHaveBeenCalledTimes(1)

      expect(vCustom.beforeUnmount).toHaveBeenCalledWith(
        el,
        expect.objectContaining({ value: 1, oldValue: 0 }),
        expect.any(Object),
        null,
      )
      expect(vCustom.unmounted).toHaveBeenCalledWith(
        el,
        expect.objectContaining({ value: 1, oldValue: 0 }),
        expect.any(Object),
        null,
      )
    })

    test('warn on directive with non-element root vapor child', () => {
      const calls: string[] = []
      const vCustom = {
        created: () => calls.push('created'),
        beforeMount: () => calls.push('beforeMount'),
        mounted: () => calls.push('mounted'),
        beforeUpdate: () => calls.push('beforeUpdate'),
        updated: () => calls.push('updated'),
        beforeUnmount: () => calls.push('beforeUnmount'),
        unmounted: () => calls.push('unmounted'),
      }

      const VaporChild = defineVaporComponent({
        setup() {
          return [template('<div></div>')(), template('<div></div>')()]
        },
      })

      const App = defineComponent({
        setup() {
          return () =>
            h('div', null, [withDirectives(h(VaporChild as any), [[vCustom]])])
        },
      })

      const root = document.createElement('div')
      const app = createApp(App)
      app.use(vaporInteropPlugin)
      app.mount(root)

      if (__DEV__) {
        expect(
          `Runtime directive used on component with non-element root node.`,
        ).toHaveBeenWarned()
      }
      expect(calls.length).toBe(0)
      app.unmount()
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

    test('slots.default() direct invocation', () => {
      const VDomChild = defineComponent({
        setup(_, { slots }) {
          return () => h('div', null, slots.default!())
        },
      })

      const VaporChild = defineVaporComponent({
        setup() {
          return createComponent(
            VDomChild as any,
            null,
            {
              default: () => template('direct call slot')(),
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

      expect(html()).toBe('<div>direct call slot</div>')
    })

    test('slots.default() with slot props', () => {
      const VDomChild = defineComponent({
        setup(_, { slots }) {
          return () => h('div', null, slots.default!({ msg: 'hello' }))
        },
      })

      const VaporChild = defineVaporComponent({
        setup() {
          return createComponent(
            VDomChild as any,
            null,
            {
              default: (props: { msg: string }) => {
                const n0 = template('<span></span>')()
                n0.textContent = props.msg
                return [n0]
              },
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

      expect(html()).toBe('<div><span>hello</span></div>')
    })

    test('named slot with slots[name]() invocation', () => {
      const VDomChild = defineComponent({
        setup(_, { slots }) {
          return () =>
            h('div', null, [
              h('header', null, slots.header!()),
              h('main', null, slots.default!()),
              h('footer', null, slots.footer!()),
            ])
        },
      })

      const VaporChild = defineVaporComponent({
        setup() {
          return createComponent(
            VDomChild as any,
            null,
            {
              header: () => template('Header')(),
              default: () => template('Main')(),
              footer: () => template('Footer')(),
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

      expect(html()).toBe(
        '<div><header>Header</header><main>Main</main><footer>Footer</footer></div>',
      )
    })

    test('slots.default() return directly', () => {
      const VDomChild = defineComponent({
        setup(_, { slots }) {
          return () => slots.default!()
        },
      })

      const VaporChild = defineVaporComponent({
        setup() {
          return createComponent(
            VDomChild as any,
            null,
            {
              default: () => template('direct return slot')(),
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

      expect(html()).toBe('direct return slot')
    })

    test('rendering forwarding vapor slot', () => {
      const VDomChild = defineComponent({
        setup(_, { slots }) {
          return () => h('div', null, { default: slots.default })
        },
      })

      const VaporChild = defineVaporComponent({
        setup() {
          return createComponent(
            VDomChild as any,
            null,
            {
              default: () => template('forwarded slot')(),
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

      expect(html()).toBe('<div>forwarded slot</div>')
    })
  })

  describe('provide / inject', () => {
    it('should inject value from vdom parent', async () => {
      const VaporChild = defineVaporComponent({
        setup() {
          const foo = inject('foo')
          const n0 = template(' ')() as any
          renderEffect(() => setText(n0, toDisplayString(foo)))
          return n0
        },
      })

      const value = ref('foo')
      const { html } = define({
        setup() {
          provide('foo', value)
          return () => h(VaporChild as any)
        },
      }).render()

      expect(html()).toBe('foo')

      value.value = 'bar'
      await nextTick()
      expect(html()).toBe('bar')
    })
  })

  describe('template ref', () => {
    it('useTemplateRef with vapor child', async () => {
      const VaporChild = defineVaporComponent({
        setup(_, { expose }) {
          const foo = ref('foo')
          expose({ foo })
          const n0 = template(' ')() as any
          renderEffect(() => setText(n0, toDisplayString(foo)))
          return n0
        },
      })

      let elRef: ShallowRef
      const { html } = define({
        setup() {
          elRef = useTemplateRef('el')
          return () => h(VaporChild as any, { ref: 'el' })
        },
      }).render()

      expect(html()).toBe('foo')

      elRef!.value.foo = 'bar'
      await nextTick()
      expect(html()).toBe('bar')
    })

    it('static ref with vapor child', async () => {
      const VaporChild = defineVaporComponent({
        setup(_, { expose }) {
          const foo = ref('foo')
          expose({ foo })
          const n0 = template(' ')() as any
          renderEffect(() => setText(n0, toDisplayString(foo)))
          return n0
        },
      })

      let elRef: ShallowRef
      const { html } = define({
        setup() {
          elRef = shallowRef()
          return { elRef }
        },
        render() {
          return h(VaporChild as any, { ref: 'elRef' })
        },
      }).render()

      expect(html()).toBe('foo')

      elRef!.value.foo = 'bar'
      await nextTick()
      expect(html()).toBe('bar')
    })
  })

  describe('dynamic component', () => {
    it('dynamic component with vapor child', async () => {
      const VaporChild = defineVaporComponent({
        setup() {
          return template('<div>vapor child</div>')() as any
        },
      })

      const VdomChild = defineComponent({
        setup() {
          return () => h('div', 'vdom child')
        },
      })

      const view = shallowRef<any>(VaporChild)
      const { html } = define({
        setup() {
          return () => h(resolveDynamicComponent(view.value) as any)
        },
      }).render()

      expect(html()).toBe('<div>vapor child</div>')

      view.value = VdomChild
      await nextTick()
      expect(html()).toBe('<div>vdom child</div>')

      view.value = VaporChild
      await nextTick()
      expect(html()).toBe('<div>vapor child</div>')
    })

    describe('render VNodes', () => {
      it('should render VNode containing vapor component from VDOM slot', async () => {
        const VaporComp = defineVaporComponent({
          setup() {
            return template('<div>vapor comp</div>')() as any
          },
        })

        const RouterView = defineComponent({
          setup(_, { slots }) {
            return () => {
              const component = h(VaporComp as any)
              return slots.default!({ Component: component })
            }
          },
        })

        const App = defineVaporComponent({
          setup() {
            return createComponent(
              RouterView as any,
              null,
              {
                default: (slotProps: { Component: any }) => {
                  return createDynamicComponent(() => slotProps.Component)
                },
              },
              true,
            )
          },
        })

        const { html } = define({
          setup() {
            return () => h(App as any)
          },
        }).render()

        expect(html()).toBe('<div>vapor comp</div><!--dynamic-component-->')
      })

      it('should render VNode containing vdom component from VDOM slot', async () => {
        const VdomComp = defineComponent({
          setup() {
            return () => h('div', 'vdom comp')
          },
        })

        const RouterView = defineComponent({
          setup(_, { slots }) {
            return () => {
              const component = h(VdomComp)
              return slots.default!({ Component: component })
            }
          },
        })

        const App = defineVaporComponent({
          setup() {
            return createComponent(
              RouterView as any,
              null,
              {
                default: (slotProps: { Component: any }) => {
                  return createDynamicComponent(() => slotProps.Component)
                },
              },
              true,
            )
          },
        })

        const { html } = define({
          setup() {
            return () => h(App as any)
          },
        }).render()

        expect(html()).toBe('<div>vdom comp</div><!--dynamic-component-->')
      })

      it('should update when VNode changes', async () => {
        const VaporCompA = defineVaporComponent({
          setup() {
            return template('<div>vapor A</div>')() as any
          },
        })

        const VaporCompB = defineVaporComponent({
          setup() {
            return template('<div>vapor B</div>')() as any
          },
        })

        const current = shallowRef<any>(VaporCompA)

        const RouterView = defineComponent({
          setup(_, { slots }) {
            return () => {
              const component = h(current.value as any)
              return slots.default!({ Component: component })
            }
          },
        })

        const App = defineVaporComponent({
          setup() {
            return createComponent(
              RouterView as any,
              null,
              {
                default: (slotProps: { Component: any }) => {
                  return createDynamicComponent(() => slotProps.Component)
                },
              },
              true,
            )
          },
        })

        const { html } = define({
          setup() {
            return () => h(App as any)
          },
        }).render()

        expect(html()).toBe('<div>vapor A</div><!--dynamic-component-->')
        current.value = VaporCompB
        await nextTick()
        expect(html()).toBe('<div>vapor B</div><!--dynamic-component-->')
      })

      describe('with VaporKeepAlive', () => {
        it('switch VNode with inner vapor components', async () => {
          const hooksA = {
            mounted: vi.fn(),
            activated: vi.fn(),
            deactivated: vi.fn(),
            unmounted: vi.fn(),
          }
          const hooksB = {
            mounted: vi.fn(),
            activated: vi.fn(),
            deactivated: vi.fn(),
            unmounted: vi.fn(),
          }

          const VaporCompA = defineVaporComponent({
            setup() {
              onMounted(() => hooksA.mounted())
              onActivated(() => hooksA.activated())
              onDeactivated(() => hooksA.deactivated())
              onUnmounted(() => hooksA.unmounted())
              return template('<div>vapor A</div>')() as any
            },
          })

          const VaporCompB = defineVaporComponent({
            setup() {
              onMounted(() => hooksB.mounted())
              onActivated(() => hooksB.activated())
              onDeactivated(() => hooksB.deactivated())
              onUnmounted(() => hooksB.unmounted())
              return template('<div>vapor B</div>')() as any
            },
          })

          const current = shallowRef<any>(VaporCompA)

          const RouterView = defineComponent({
            setup(_, { slots }) {
              return () => {
                const component = h(current.value as any)
                return slots.default!({ Component: component })
              }
            },
          })

          const App = defineVaporComponent({
            setup() {
              return createComponent(
                RouterView as any,
                null,
                {
                  default: (slotProps: { Component: any }) => {
                    return createComponent(VaporKeepAlive, null, {
                      default: () =>
                        createDynamicComponent(() => slotProps.Component),
                    })
                  },
                },
                true,
              )
            },
          })

          const { html } = define({
            setup() {
              return () => h(App as any)
            },
          }).render()

          expect(html()).toBe('<div>vapor A</div><!--dynamic-component-->')
          // A: mounted + activated
          expect(hooksA.mounted).toHaveBeenCalledTimes(1)
          expect(hooksA.activated).toHaveBeenCalledTimes(1)
          expect(hooksA.deactivated).toHaveBeenCalledTimes(0)
          expect(hooksA.unmounted).toHaveBeenCalledTimes(0)

          current.value = VaporCompB
          await nextTick()
          expect(html()).toBe('<div>vapor B</div><!--dynamic-component-->')
          // A: deactivated (cached)
          expect(hooksA.deactivated).toHaveBeenCalledTimes(1)
          expect(hooksA.unmounted).toHaveBeenCalledTimes(0)
          // B: mounted + activated
          expect(hooksB.mounted).toHaveBeenCalledTimes(1)
          expect(hooksB.activated).toHaveBeenCalledTimes(1)

          current.value = VaporCompA
          await nextTick()
          expect(html()).toBe('<div>vapor A</div><!--dynamic-component-->')
          // B: deactivated (cached)
          expect(hooksB.deactivated).toHaveBeenCalledTimes(1)
          expect(hooksB.unmounted).toHaveBeenCalledTimes(0)
          // A: re-activated (not re-mounted)
          expect(hooksA.mounted).toHaveBeenCalledTimes(1)
          expect(hooksA.activated).toHaveBeenCalledTimes(2)
        })

        it('switch VNode with inner VDOM components', async () => {
          const hooksA = {
            mounted: vi.fn(),
            activated: vi.fn(),
            deactivated: vi.fn(),
            unmounted: vi.fn(),
          }
          const hooksB = {
            mounted: vi.fn(),
            activated: vi.fn(),
            deactivated: vi.fn(),
            unmounted: vi.fn(),
          }

          const VDOMCompA = defineComponent({
            setup() {
              onMounted(() => hooksA.mounted())
              onActivated(() => hooksA.activated())
              onDeactivated(() => hooksA.deactivated())
              onUnmounted(() => hooksA.unmounted())
              return () => h('div', 'vdom A')
            },
          })

          const VDOMCompB = defineComponent({
            setup() {
              onMounted(() => hooksB.mounted())
              onActivated(() => hooksB.activated())
              onDeactivated(() => hooksB.deactivated())
              onUnmounted(() => hooksB.unmounted())
              return () => h('div', 'vdom B')
            },
          })

          const current = shallowRef<any>(VDOMCompA)

          const RouterView = defineComponent({
            setup(_, { slots }) {
              return () => {
                const component = h(current.value as any)
                return slots.default!({ Component: component })
              }
            },
          })

          const App = defineVaporComponent({
            setup() {
              return createComponent(
                RouterView as any,
                null,
                {
                  default: (slotProps: { Component: any }) => {
                    return createComponent(VaporKeepAlive, null, {
                      default: () =>
                        createDynamicComponent(() => slotProps.Component),
                    })
                  },
                },
                true,
              )
            },
          })

          const { html } = define({
            setup() {
              return () => h(App as any)
            },
          }).render()

          expect(html()).toBe('<div>vdom A</div><!--dynamic-component-->')
          // A: mounted + activated
          expect(hooksA.mounted).toHaveBeenCalledTimes(1)
          expect(hooksA.activated).toHaveBeenCalledTimes(1)
          expect(hooksA.deactivated).toHaveBeenCalledTimes(0)
          expect(hooksA.unmounted).toHaveBeenCalledTimes(0)

          current.value = VDOMCompB
          await nextTick()
          expect(html()).toBe('<div>vdom B</div><!--dynamic-component-->')
          // A: deactivated (cached)
          expect(hooksA.deactivated).toHaveBeenCalledTimes(1)
          expect(hooksA.unmounted).toHaveBeenCalledTimes(0)
          // B: mounted + activated
          expect(hooksB.mounted).toHaveBeenCalledTimes(1)
          expect(hooksB.activated).toHaveBeenCalledTimes(1)

          current.value = VDOMCompA
          await nextTick()
          expect(html()).toBe('<div>vdom A</div><!--dynamic-component-->')
          // B: deactivated (cached)
          expect(hooksB.deactivated).toHaveBeenCalledTimes(1)
          expect(hooksB.unmounted).toHaveBeenCalledTimes(0)
          // A: re-activated (not re-mounted)
          expect(hooksA.mounted).toHaveBeenCalledTimes(1)
          expect(hooksA.activated).toHaveBeenCalledTimes(2)
        })

        it('switch VNode with inner mixed vapor/VDOM components', async () => {
          const hooksA = {
            mounted: vi.fn(),
            activated: vi.fn(),
            deactivated: vi.fn(),
            unmounted: vi.fn(),
          }
          const hooksB = {
            mounted: vi.fn(),
            activated: vi.fn(),
            deactivated: vi.fn(),
            unmounted: vi.fn(),
          }

          const VaporCompA = defineVaporComponent({
            setup() {
              onMounted(() => hooksA.mounted())
              onActivated(() => hooksA.activated())
              onDeactivated(() => hooksA.deactivated())
              onUnmounted(() => hooksA.unmounted())
              return template('<div>vapor A</div>')()
            },
          })

          const VDOMCompB = defineComponent({
            setup() {
              onMounted(() => hooksB.mounted())
              onActivated(() => hooksB.activated())
              onDeactivated(() => hooksB.deactivated())
              onUnmounted(() => hooksB.unmounted())
              return () => h('div', 'vdom B')
            },
          })

          const current = shallowRef<any>(VaporCompA)

          const RouterView = defineComponent({
            setup(_, { slots }) {
              return () => {
                const component = h(current.value as any)
                return slots.default!({ Component: component })
              }
            },
          })

          const App = defineVaporComponent({
            setup() {
              return createComponent(
                RouterView as any,
                null,
                {
                  default: (slotProps: { Component: any }) => {
                    return createComponent(VaporKeepAlive, null, {
                      default: () =>
                        createDynamicComponent(() => slotProps.Component),
                    })
                  },
                },
                true,
              )
            },
          })

          const { html } = define({
            setup() {
              return () => h(App as any)
            },
          }).render()

          expect(html()).toBe('<div>vapor A</div><!--dynamic-component-->')
          // A (vapor): mounted + activated
          expect(hooksA.mounted).toHaveBeenCalledTimes(1)
          expect(hooksA.activated).toHaveBeenCalledTimes(1)
          expect(hooksA.deactivated).toHaveBeenCalledTimes(0)
          expect(hooksA.unmounted).toHaveBeenCalledTimes(0)

          current.value = VDOMCompB
          await nextTick()
          expect(html()).toBe('<div>vdom B</div><!--dynamic-component-->')
          // A (vapor): deactivated (cached)
          expect(hooksA.deactivated).toHaveBeenCalledTimes(1)
          expect(hooksA.unmounted).toHaveBeenCalledTimes(0)
          // B (vdom): mounted + activated
          expect(hooksB.mounted).toHaveBeenCalledTimes(1)
          expect(hooksB.activated).toHaveBeenCalledTimes(1)

          current.value = VaporCompA
          await nextTick()
          expect(html()).toBe('<div>vapor A</div><!--dynamic-component-->')
          // B (vdom): deactivated (cached)
          expect(hooksB.deactivated).toHaveBeenCalledTimes(1)
          expect(hooksB.unmounted).toHaveBeenCalledTimes(0)
          // A (vapor): re-activated (not re-mounted)
          expect(hooksA.mounted).toHaveBeenCalledTimes(1)
          expect(hooksA.activated).toHaveBeenCalledTimes(2)
        })
      })
    })
  })

  describe('attribute fallthrough', () => {
    it('should fallthrough attrs to vdom child', () => {
      const VDomChild = defineComponent({
        setup() {
          return () => h('div')
        },
      })

      const VaporChild = defineVaporComponent({
        setup() {
          return createComponent(
            VDomChild as any,
            { foo: () => 'vapor foo' },
            null,
            true,
          )
        },
      })

      const { html } = define({
        setup() {
          return () => h(VaporChild as any, { foo: 'foo', bar: 'bar' })
        },
      }).render()
      expect(html()).toBe('<div foo="foo" bar="bar"></div>')
    })

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

  describe('async component', () => {
    const duration = 5
    test('render vapor async component', async () => {
      const VdomChild = {
        setup() {
          return () => h('div', 'foo')
        },
      }
      const VaporAsyncChild = defineVaporAsyncComponent({
        loader: () => {
          return new Promise(r => {
            setTimeout(() => {
              r(VdomChild as any)
            }, duration)
          })
        },
        loadingComponent: () => h('span', 'loading...'),
      })

      const { html } = define({
        setup() {
          return () => h(VaporAsyncChild as any)
        },
      }).render()

      expect(html()).toBe('<span>loading...</span><!--async component-->')

      await new Promise(r => setTimeout(r, duration))
      await nextTick()
      expect(html()).toBe('<div>foo</div><!--async component-->')
    })
  })

  describe('keepalive', () => {
    function assertHookCalls(
      hooks: {
        beforeMount: any
        mounted: any
        activated: any
        deactivated: any
        unmounted: any
      },
      callCounts: number[],
    ) {
      expect([
        hooks.beforeMount.mock.calls.length,
        hooks.mounted.mock.calls.length,
        hooks.activated.mock.calls.length,
        hooks.deactivated.mock.calls.length,
        hooks.unmounted.mock.calls.length,
      ]).toEqual(callCounts)
    }

    let hooks: any
    beforeEach(() => {
      hooks = {
        beforeMount: vi.fn(),
        mounted: vi.fn(),
        activated: vi.fn(),
        deactivated: vi.fn(),
        unmounted: vi.fn(),
      }
    })

    test('render vapor component', async () => {
      const VaporChild = defineVaporComponent({
        setup() {
          const msg = ref('vapor')
          onBeforeMount(() => hooks.beforeMount())
          onMounted(() => hooks.mounted())
          onActivated(() => hooks.activated())
          onDeactivated(() => hooks.deactivated())
          onUnmounted(() => hooks.unmounted())

          const n0 = template('<input type="text">', true)() as any
          applyTextModel(
            n0,
            () => msg.value,
            _value => (msg.value = _value),
          )
          return n0
        },
      })

      const show = ref(true)
      const toggle = ref(true)
      const { html, host } = define({
        setup() {
          return () =>
            show.value
              ? h(KeepAlive, null, {
                  default: () => (toggle.value ? h(VaporChild as any) : null),
                })
              : null
        },
      }).render()

      expect(html()).toBe('<input type="text">')
      let inputEl = host.firstChild as HTMLInputElement
      expect(inputEl.value).toBe('vapor')
      assertHookCalls(hooks, [1, 1, 1, 0, 0])

      // change input value
      inputEl.value = 'changed'
      inputEl.dispatchEvent(new Event('input'))
      await nextTick()

      // deactivate
      toggle.value = false
      await nextTick()
      expect(html()).toBe('<!---->')
      assertHookCalls(hooks, [1, 1, 1, 1, 0])

      // activate
      toggle.value = true
      await nextTick()
      expect(html()).toBe('<input type="text">')
      inputEl = host.firstChild as HTMLInputElement
      expect(inputEl.value).toBe('changed')
      assertHookCalls(hooks, [1, 1, 2, 1, 0])

      // unmount keepalive
      show.value = false
      await nextTick()
      expect(html()).toBe('<!---->')
      assertHookCalls(hooks, [1, 1, 2, 2, 1])

      // mount keepalive
      show.value = true
      await nextTick()
      inputEl = host.firstChild as HTMLInputElement
      expect(inputEl.value).toBe('vapor')
      assertHookCalls(hooks, [2, 2, 3, 2, 1])
    })
  })
})
