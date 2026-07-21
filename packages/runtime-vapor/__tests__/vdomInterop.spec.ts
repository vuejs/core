import {
  KeepAlive,
  type ShallowRef,
  Suspense,
  Teleport,
  Transition,
  cloneVNode,
  createApp,
  createCommentVNode,
  createVNode,
  currentInstance,
  defineComponent,
  getCurrentScope,
  h,
  inject,
  nextTick,
  onActivated,
  onBeforeMount,
  onBeforeUpdate,
  onDeactivated,
  onErrorCaptured,
  onMounted,
  onUnmounted,
  onUpdated,
  provide,
  ref,
  renderSlot,
  resolveComponent,
  resolveDynamicComponent,
  shallowRef,
  toDisplayString,
  useModel,
  useSlots,
  useTemplateRef,
  vShow,
  withCtx,
  withDirectives,
} from '@vue/runtime-dom'
import { VaporDynamicComponentFlags, VaporSlotFlags } from '@vue/shared'
import { VaporSlot } from '../../runtime-core/src/vnode'
import { compile, makeInteropRender } from './_utils'
import {
  VaporKeepAlive,
  VaporTeleport,
  applyTextModel,
  applyVShow,
  child,
  createComponent,
  createDynamicComponent,
  createForSlots,
  createIf,
  createSlot,
  createTemplateRefSetter,
  createVaporApp,
  defineVaporAsyncComponent,
  defineVaporComponent,
  insert,
  renderEffect,
  setText,
  template,
  txt,
  vaporInteropPlugin,
  withAsyncContext,
} from '../src'

const define = makeInteropRender()

describe('vdomInterop', () => {
  describe('key', () => {
    test('preserves vnode key on blocks passed from vdom to vapor', () => {
      const VDomChild = defineComponent({
        setup() {
          return () => h('div', 'vdom child')
        },
      })

      const app = createApp({ render: () => null })
      app.use(vaporInteropPlugin)
      const vapor = (app._context as any).vapor

      const vnodeBlock = vapor.vdomMountVNode(
        h(VDomChild, { key: 'foo' }),
        null,
      )
      expect(vnodeBlock.$key).toBe('foo')
      expect(vnodeBlock.vnode.key).toBe('foo')

      const componentBlock = vapor.vdomMount(VDomChild, null, { key: 'bar' })
      expect(componentBlock.$key).toBe('bar')
      expect(componentBlock.vnode.key).toBe('bar')
    })

    test('preserves single slot vnode key on interop fragments', async () => {
      const key = ref('foo')

      const CompA = defineComponent({
        setup() {
          return () => h('div', 'A')
        },
      })
      const CompB = defineComponent({
        setup() {
          return () => h('div', 'B')
        },
      })
      const current = shallowRef<any>(CompA)

      const VaporChild = defineVaporComponent({
        setup() {
          return createSlot('default') as any
        },
      })

      const Parent = defineComponent({
        setup() {
          return () =>
            h(VaporChild as any, null, {
              default: () => [h(current.value, { key: key.value })],
            })
        },
      })

      const app = createApp(Parent)
      app.use(vaporInteropPlugin)
      const vapor = (app._context as any).vapor
      const originalVdomSlot = vapor.vdomSlot
      let frag: any
      vapor.vdomSlot = (...args: any[]) => (frag = originalVdomSlot(...args))

      const host = document.createElement('div')
      app.mount(host)

      expect(frag.$key).toBe('_defaultfoo')

      key.value = 'bar'
      current.value = CompB
      await nextTick()

      expect(frag.$key).toBe('_defaultbar')
    })
  })

  describe('fragment nodes', () => {
    test('refreshes interop fragment nodes after component root updates', async () => {
      const show = ref(false)
      const VDomChild = defineComponent({
        setup() {
          return () =>
            show.value ? h('div', 'child') : createCommentVNode('v-if', true)
        },
      })

      const app = createApp({ render: () => null })
      app.use(vaporInteropPlugin)
      const vapor = (app._context as any).vapor
      const host = document.createElement('div')

      const frag = vapor.vdomMount(VDomChild, null)
      insert(frag, host)

      expect(host.innerHTML).toBe('<!--v-if-->')
      expect(frag.nodes).toBeInstanceOf(Comment)

      show.value = true
      await nextTick()

      expect(host.innerHTML).toBe('<div>child</div>')
      expect(frag.nodes).toBeInstanceOf(HTMLDivElement)
    })

    test('refreshes vdom slot fragment nodes after child root updates', async () => {
      const show = ref(false)
      const VDomChild = defineComponent({
        setup() {
          return () =>
            show.value ? h('div', 'child') : createCommentVNode('v-if', true)
        },
      })

      const VaporChild = defineVaporComponent({
        setup() {
          return createSlot('default') as any
        },
      })

      const Parent = defineComponent({
        setup() {
          return () =>
            h(VaporChild as any, null, {
              default: () => [h(VDomChild)],
            })
        },
      })

      const app = createApp(Parent)
      app.use(vaporInteropPlugin)
      const vapor = (app._context as any).vapor
      const originalVdomSlot = vapor.vdomSlot
      let frag: any
      vapor.vdomSlot = (...args: any[]) => (frag = originalVdomSlot(...args))

      const host = document.createElement('div')
      app.mount(host)

      const calls: string[] = []
      frag.onBeforeUpdate = [() => calls.push('beforeUpdate')]
      frag.onUpdated = [() => calls.push('updated')]

      const getNodes = () =>
        (Array.isArray(frag.nodes) ? frag.nodes : [frag.nodes]).filter(Boolean)

      expect(host.innerHTML).toBe('<!--v-if-->')
      expect(getNodes().some((n: Node) => n instanceof HTMLDivElement)).toBe(
        false,
      )

      show.value = true
      await nextTick()

      expect(host.innerHTML).toContain('<div>child</div>')
      expect(getNodes().some((n: Node) => n instanceof HTMLDivElement)).toBe(
        true,
      )
      expect(calls).toEqual(['beforeUpdate', 'updated'])
    })

    test('mounts vnode slot content after active fallback without reusing invalid vnode content', async () => {
      const show = ref(false)
      const childRef = ref<any>(null)
      const mounted = vi.fn()
      const unmounted = vi.fn()

      const VDomChild = defineComponent({
        setup() {
          onMounted(mounted)
          onUnmounted(unmounted)
          return () => h('div', 'child')
        },
      })

      const VaporChild = defineVaporComponent({
        setup() {
          return createSlot('default', null, () =>
            template('<span>fallback</span>')(),
          ) as any
        },
      })

      const Parent = defineComponent({
        setup() {
          return () =>
            h(VaporChild as any, null, {
              default: () =>
                show.value ? [h(VDomChild, { ref: childRef })] : [],
            })
        },
      })

      const app = createApp(Parent)
      app.use(vaporInteropPlugin)
      const root = document.createElement('div')
      app.mount(root)

      expect(root.innerHTML).toBe('<span>fallback</span>')
      expect(childRef.value).toBe(null)
      expect(mounted).not.toHaveBeenCalled()
      expect(unmounted).not.toHaveBeenCalled()

      show.value = true
      await nextTick()

      expect(root.innerHTML).toBe('<div>child</div>')
      expect(childRef.value).not.toBe(null)
      expect(mounted).toHaveBeenCalledTimes(1)
      expect(unmounted).not.toHaveBeenCalled()

      show.value = false
      await nextTick()

      expect(root.innerHTML).toBe('<span>fallback</span>')
      expect(childRef.value).toBe(null)
      expect(mounted).toHaveBeenCalledTimes(1)
      expect(unmounted).toHaveBeenCalledTimes(1)

      show.value = true
      await nextTick()

      expect(root.innerHTML).toBe('<div>child</div>')
      expect(childRef.value).not.toBe(null)
      expect(mounted).toHaveBeenCalledTimes(2)
      expect(unmounted).toHaveBeenCalledTimes(1)

      app.unmount()
      expect(childRef.value).toBe(null)
      expect(unmounted).toHaveBeenCalledTimes(2)
    })
  })

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

    test('should warn on invalid prop when vapor renders vdom component', async () => {
      const base = ref<unknown>('invalid')
      const VDomChild = defineComponent({
        props: {
          base: Number,
        },
        render: () => h('div'),
      })

      const VaporChild = defineVaporComponent(() =>
        createComponent(VDomChild as any, {
          base: () => base.value,
        }),
      )

      define(() => h(VaporChild as any)).render()

      expect('type check failed for prop "base"').toHaveBeenWarnedTimes(1)

      base.value = 'still invalid'
      await nextTick()
      expect('type check failed for prop "base"').toHaveBeenWarnedTimes(2)
    })

    test('should not pass reserved props into vapor attrs on update', async () => {
      const msg = ref('foo')
      const onVnodeMounted = vi.fn()

      const VaporChild = defineVaporComponent({
        setup(_, { attrs }) {
          const n0 = template(' ')() as any
          renderEffect(() => {
            setText(
              n0,
              `${String(attrs.msg)}|${String('onVnodeMounted' in attrs)}`,
            )
          })
          return n0
        },
      })

      const { html } = define({
        setup() {
          return () =>
            h(VaporChild as any, {
              msg: msg.value,
              onVnodeMounted,
            })
        },
      }).render()

      expect(html()).toBe('foo|false')

      msg.value = 'bar'
      await nextTick()
      expect(html()).toBe('bar|false')
    })

    test('should invoke onVnodeMounted and onVnodeUnmounted', async () => {
      const VaporChild = defineVaporComponent({
        setup() {
          return template('<div>vapor</div>')()
        },
      })

      const show = ref(true)
      const vnodeMounted = vi.fn()
      const vnodeUnmounted = vi.fn()

      const { html } = define({
        setup() {
          return () =>
            show.value
              ? h(VaporChild as any, {
                  onVnodeMounted: vnodeMounted,
                  onVnodeUnmounted: vnodeUnmounted,
                })
              : null
        },
      }).render()
      await nextTick()

      expect(html()).toBe('<div>vapor</div>')
      expect(vnodeMounted).toHaveBeenCalledTimes(1)
      expect(vnodeUnmounted).toHaveBeenCalledTimes(0)

      show.value = false
      await nextTick()
      expect(vnodeUnmounted).toHaveBeenCalledTimes(1)
    })

    test('should invoke vnode and directive mount hooks in VDOM order', async () => {
      const calls: string[] = []
      const vCustom = {
        created: vi.fn(() => calls.push('directive created')),
        beforeMount: vi.fn(() => calls.push('directive beforeMount')),
        mounted: vi.fn(() => calls.push('directive mounted')),
      }

      const VaporChild = defineVaporComponent({
        setup() {
          return template('<div>vapor</div>')()
        },
      })

      const App = defineComponent({
        setup() {
          return () =>
            withDirectives(
              h(VaporChild as any, {
                onVnodeBeforeMount: () => calls.push('vnode beforeMount'),
                onVnodeMounted: () => calls.push('vnode mounted'),
              }),
              [[vCustom]],
            )
        },
      })

      const root = document.createElement('div')
      const app = createApp(App)
      app.use(vaporInteropPlugin)
      app.mount(root)
      await nextTick()

      expect(calls).toEqual([
        'vnode beforeMount',
        'directive created',
        'directive beforeMount',
        'directive mounted',
        'vnode mounted',
      ])
    })

    test('should invoke vnode and directive unmount hooks in VDOM order', async () => {
      const calls: string[] = []
      const vCustom = {
        beforeUnmount: vi.fn(() => calls.push('directive beforeUnmount')),
        unmounted: vi.fn(() => calls.push('directive unmounted')),
      }

      const VaporChild = defineVaporComponent({
        setup() {
          return template('<div>vapor</div>')()
        },
      })

      const show = ref(true)
      const { html } = define({
        setup() {
          return () =>
            show.value
              ? withDirectives(
                  h(VaporChild as any, {
                    onVnodeBeforeUnmount: () =>
                      calls.push('vnode beforeUnmount'),
                    onVnodeUnmounted: () => calls.push('vnode unmounted'),
                  }),
                  [[vCustom]],
                )
              : null
        },
      }).render()

      expect(html()).toBe('<div>vapor</div>')

      show.value = false
      await nextTick()

      expect(calls).toEqual([
        'vnode beforeUnmount',
        'directive beforeUnmount',
        'directive unmounted',
        'vnode unmounted',
      ])
    })

    test('should invoke update hooks in VDOM order on normal updates', async () => {
      const msg = ref('foo')
      const calls: string[] = []

      const vCustom = {
        beforeUpdate: vi.fn(() => calls.push('directive beforeUpdate')),
        updated: vi.fn(() => calls.push('directive updated')),
      }

      const VaporChild = defineVaporComponent({
        props: {
          msg: String,
        },
        setup(props: any) {
          const n0 = template('<div> </div>', 1)() as any
          const x0 = child(n0) as any
          renderEffect(() => {
            setText(x0, props.msg)
          })
          return n0
        },
      })

      const App = defineComponent({
        setup() {
          return () =>
            withDirectives(
              h(VaporChild as any, {
                msg: msg.value,
                onVnodeBeforeUpdate: () => calls.push('vnode beforeUpdate'),
                onVnodeUpdated: () => calls.push('vnode updated'),
              }),
              [[vCustom]],
            )
        },
      })

      const root = document.createElement('div')
      const app = createApp(App)
      app.use(vaporInteropPlugin)
      app.mount(root)

      msg.value = 'bar'
      await nextTick()

      expect(calls).toEqual([
        'vnode beforeUpdate',
        'directive beforeUpdate',
        'directive updated',
        'vnode updated',
      ])
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
            VaporDynamicComponentFlags.SINGLE_ROOT,
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

    test('apply v-show transition to vdom child', async () => {
      let finishLeave: (() => void) | undefined
      const onBeforeEnter = vi.fn()
      const onEnter = vi.fn((_el: Element, done: () => void) => done())
      const onLeave = vi.fn((_el: Element, done: () => void) => {
        finishLeave = done
      })
      const data = ref({
        show: true,
        onBeforeEnter,
        onEnter,
        onLeave,
      })
      const VDomChild = compile(
        `<script setup>const text = 'Comp text'</script><template><div>{{ text }}</div></template>`,
        data,
        {},
        { vapor: false },
      )
      const App = compile(
        `<template>
          <Transition
            :css="false"
            @before-enter="data.onBeforeEnter"
            @enter="data.onEnter"
            @leave="data.onLeave"
          >
            <components.VDomChild v-show="data.show" />
          </Transition>
        </template>`,
        data,
        { VDomChild },
      )
      const { host } = define(App as any).render()
      document.body.appendChild(host)
      const el = host.querySelector('div')!

      data.value.show = false
      await nextTick()

      expect(onLeave).toHaveBeenCalledOnce()
      expect(el.style.display).toBe('')

      finishLeave!()
      expect(el.style.display).toBe('none')

      data.value.show = true
      await nextTick()

      expect(onBeforeEnter).toHaveBeenCalledOnce()
      expect(onEnter).toHaveBeenCalledOnce()
      expect(el.style.display).toBe('')
    })

    test('apply v-show to vapor child', async () => {
      const VaporChild = defineVaporComponent({
        setup() {
          return template('<div></div>', 1)()
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
          return template('<div></div>', 1)()
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

    test('should expose the latest vapor root element in updated hooks', async () => {
      const useAltRoot = ref(false)
      const updatedSpy = vi.fn((vnode: any) => {
        expect((vnode.el as Element).tagName).toBe('P')
      })

      const VaporChild = defineVaporComponent({
        props: {
          alt: Boolean,
        },
        setup(props: any) {
          return createIf(
            () => props.alt,
            () => template('<p>alt</p>')(),
            () => template('<div>base</div>')(),
          )
        },
      })

      const App = defineComponent({
        setup() {
          return () =>
            h(VaporChild as any, {
              alt: useAltRoot.value,
              onVnodeUpdated: updatedSpy,
            })
        },
      })

      const root = document.createElement('div')
      const app = createApp(App)
      app.use(vaporInteropPlugin)
      app.mount(root)

      useAltRoot.value = true
      await nextTick()

      expect(root.querySelector('p')).not.toBeNull()
      expect(updatedSpy).toHaveBeenCalledTimes(1)
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

    test('does not expose Vapor dynamic slots marker to vdom slots', () => {
      const keys: string[][] = []
      const VDomChild = defineComponent({
        setup(_, { slots }) {
          return () => {
            keys.push(Object.keys(slots))
            return renderSlot(slots, 'default')
          }
        },
      })

      const VaporChild = defineVaporComponent({
        setup() {
          return createComponent(
            VDomChild as any,
            null,
            {
              default: () => document.createTextNode('static slot'),
              $: [
                () => ({
                  name: 'default',
                  fn: () => document.createTextNode('dynamic slot'),
                }),
              ],
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

      expect(html()).toBe('dynamic slot')
      expect(keys).toEqual([['default']])
    })

    test('function rawSlots are normalized before mounting vdom component', () => {
      const VDomChild = defineComponent({
        setup(_, { slots }) {
          return () => h('div', null, slots.default!({ msg: 'default slot' }))
        },
      })

      const VaporChild = defineVaporComponent({
        setup() {
          return createComponent(
            VDomChild as any,
            null,
            (props: { msg: string }) => document.createTextNode(props.msg),
            true,
          )
        },
      })

      const { html } = define({
        setup() {
          return () => h(VaporChild as any)
        },
      }).render()

      expect(html()).toBe('<div>default slot</div>')
    })

    test('normalizes raw VDOM slot function values passed to Vapor', async () => {
      const msg = ref('default slot')
      const VaporChild = defineVaporComponent(() => createSlot('default', null))

      const { html } = define({
        setup() {
          return () =>
            h(VaporChild as any, null, {
              default: () => h('span', msg.value),
            })
        },
      }).render()

      expect(html()).toBe('<span>default slot</span>')

      msg.value = 'updated'
      await nextTick()
      expect(html()).toBe('<span>updated</span>')
    })

    test('keeps normalized VDOM slot identity stable across Vapor updates', async () => {
      const tick = ref(0)
      const slot = () => h('span', 'default slot')
      const observedSlots: unknown[] = []

      const VaporChild = defineVaporComponent({
        setup() {
          const slots = useSlots()
          renderEffect(() => {
            observedSlots.push(slots.default)
          })
          return createSlot('default', null)
        },
      })

      const { html } = define({
        setup() {
          return () =>
            h(
              VaporChild as any,
              { tick: tick.value },
              {
                default: slot,
              },
            )
        },
      }).render()

      expect(html()).toBe('<span>default slot</span>')
      expect(observedSlots).toHaveLength(1)

      tick.value++
      await nextTick()

      expect(observedSlots).toHaveLength(2)
      expect(observedSlots[1]).toBe(observedSlots[0])
    })

    test('applies v-once to VDOM slot content passed to Vapor', async () => {
      const msg = ref('default slot')
      const VaporChild = defineVaporComponent(() =>
        createSlot('default', null, undefined, VaporSlotFlags.ONCE),
      )

      const { html } = define({
        setup() {
          return () =>
            h(VaporChild as any, null, {
              default: () => h('span', msg.value),
            })
        },
      }).render()

      expect(html()).toBe('<span>default slot</span>')

      msg.value = 'updated'
      await nextTick()
      expect(html()).toBe('<span>default slot</span>')
    })

    test('applies v-once to dynamic VDOM slot names passed to Vapor', async () => {
      const slotName = ref('one')
      const VaporChild = defineVaporComponent(() =>
        createSlot(() => slotName.value, null, undefined, VaporSlotFlags.ONCE),
      )

      const { html } = define({
        setup() {
          return () =>
            h(VaporChild as any, null, {
              one: () => h('span', 'one'),
              two: () => h('span', 'two'),
            })
        },
      }).render()

      expect(html()).toBe('<span>one</span>')

      slotName.value = 'two'
      await nextTick()
      expect(html()).toBe('<span>one</span>')
    })

    test('applies v-once when VDOM slot availability changes', async () => {
      const show = ref(true)
      const VaporChild = defineVaporComponent(() =>
        createSlot('default', null, undefined, VaporSlotFlags.ONCE),
      )

      const { html } = define({
        setup() {
          return () =>
            h(
              VaporChild as any,
              null,
              show.value ? { default: () => h('span', 'one') } : {},
            )
        },
      }).render()

      expect(html()).toBe('<span>one</span>')

      show.value = false
      await nextTick()
      expect(html()).toBe('<span>one</span>')
    })

    test('applies v-once to VDOM slot outlet fallback', async () => {
      const msg = ref('fallback')
      const VaporChild = defineVaporComponent(() =>
        createSlot(
          'default',
          null,
          () => {
            const n0 = template('<span> </span>')() as any
            const t0 = txt(n0) as any
            renderEffect(() => setText(t0, msg.value))
            return n0
          },
          VaporSlotFlags.ONCE,
        ),
      )

      const { html } = define({
        setup() {
          return () => h(VaporChild as any)
        },
      }).render()

      expect(html()).toBe('<span>fallback</span>')

      msg.value = 'updated'
      await nextTick()
      expect(html()).toBe('<span>fallback</span>')
    })

    test('preserves VDOM child updates inside v-once slot content', async () => {
      let increment!: () => void
      const VDomChild = defineComponent({
        setup() {
          const count = ref(0)
          increment = () => count.value++
          return () => h('span', count.value)
        },
      })
      const VaporChild = defineVaporComponent(() =>
        createSlot('default', null, undefined, VaporSlotFlags.ONCE),
      )

      const { html } = define({
        setup() {
          return () =>
            h(VaporChild as any, null, {
              default: () => h(VDomChild),
            })
        },
      }).render()

      expect(html()).toBe('<span>0</span>')

      increment()
      await nextTick()
      expect(html()).toBe('<span>1</span>')
    })

    test('snapshots delayed slot prop reads inside v-once VDOM slot content', async () => {
      let increment!: () => void
      const label = ref('initial')
      const VDomChild = defineComponent({
        props: ['slotProps'],
        setup(props: any) {
          const count = ref(0)
          increment = () => count.value++
          return () => h('span', `${props.slotProps.label}:${count.value}`)
        },
      })
      const VaporChild = defineVaporComponent(() =>
        createSlot(
          'default',
          { label: () => label.value },
          undefined,
          VaporSlotFlags.ONCE,
        ),
      )

      const { html } = define({
        setup() {
          return () =>
            h(VaporChild as any, null, {
              default: (slotProps: any) => h(VDomChild, { slotProps }),
            })
        },
      }).render()

      expect(html()).toBe('<span>initial:0</span>')

      label.value = 'updated'
      increment()
      await nextTick()
      expect(html()).toBe('<span>initial:1</span>')
    })

    test('preserves VDOM child updates inside v-once fallback', async () => {
      let increment!: () => void
      const label = ref('initial')
      const VDomChild = defineComponent({
        props: ['label'],
        setup(props) {
          const count = ref(0)
          increment = () => count.value++
          return () => h('span', `${props.label}:${count.value}`)
        },
      })
      const VaporChild = defineVaporComponent(() =>
        createSlot(
          'default',
          null,
          () => createComponent(VDomChild as any, { label: () => label.value }),
          VaporSlotFlags.ONCE,
        ),
      )

      const { html } = define({
        setup() {
          return () => h(VaporChild as any)
        },
      }).render()

      expect(html()).toBe('<span>initial:0</span>')

      label.value = 'updated'
      increment()
      await nextTick()
      expect(html()).toBe('<span>initial:1</span>')
    })

    test('preserves Vapor child updates inside v-once VDOM slot content', async () => {
      let increment!: () => void
      const VaporGrandChild = defineVaporComponent({
        setup() {
          const count = ref(0)
          increment = () => count.value++
          const n0 = template('<span> </span>')() as any
          const t0 = txt(n0) as any
          renderEffect(() => setText(t0, String(count.value)))
          return n0
        },
      })
      const VaporChild = defineVaporComponent(() =>
        createSlot('default', null, undefined, VaporSlotFlags.ONCE),
      )

      const { html } = define({
        setup() {
          return () =>
            h(VaporChild as any, null, {
              default: () => h(VaporGrandChild as any),
            })
        },
      }).render()

      expect(html()).toBe('<span>0</span>')

      increment()
      await nextTick()
      expect(html()).toBe('<span>1</span>')
    })

    test('preserves VDOM child local props passed to Vapor descendants inside v-once slot content', async () => {
      let increment!: () => void
      const VaporGrandChild = defineVaporComponent({
        props: ['count'],
        setup(props: any) {
          const n0 = template('<span> </span>')() as any
          const t0 = txt(n0) as any
          renderEffect(() => setText(t0, String(props.count)))
          return n0
        },
      })
      const VDomChild = defineComponent({
        setup() {
          const count = ref(0)
          increment = () => count.value++
          return () => h(VaporGrandChild as any, { count: count.value })
        },
      })
      const VaporChild = defineVaporComponent(() =>
        createSlot('default', null, undefined, VaporSlotFlags.ONCE),
      )

      const { html } = define({
        setup() {
          return () =>
            h(VaporChild as any, null, {
              default: () => h(VDomChild),
            })
        },
      }).render()

      expect(html()).toBe('<span>0</span>')

      increment()
      await nextTick()
      expect(html()).toBe('<span>1</span>')
    })

    test('falls through to outlet fallback when vdom local fallback is invalidated or removed from VaporSlot', async () => {
      const mode = ref<'local' | 'empty' | 'none'>('local')
      const localText = ref('local fallback')
      const outletText = ref('outlet fallback')
      const localFallback = () =>
        mode.value === 'empty' ? [] : [h('div', localText.value)]

      const VDomOuterSlot = defineComponent({
        setup(_, { slots }) {
          return () =>
            renderSlot(slots, 'foo', {}, () => [h('section', outletText.value)])
        },
      })

      const VDomInnerSlot = defineComponent({
        setup(_, { slots }) {
          return () =>
            h(VDomOuterSlot, null, {
              foo: () => [
                renderSlot(
                  slots,
                  'bar',
                  {},
                  mode.value === 'none' ? undefined : localFallback,
                ),
              ],
              _: 3 /* FORWARDED */,
            })
        },
      })

      const VaporBridge = defineVaporComponent({
        setup() {
          return createComponent(
            VDomInnerSlot as any,
            null,
            {
              bar: () => createSlot('bar', null),
            },
            true,
          )
        },
      })

      const root = document.createElement('div')
      createVaporApp(VaporBridge).use(vaporInteropPlugin).mount(root)
      expect(root.innerHTML).toBe('<div>local fallback</div><!--slot-->')

      mode.value = 'empty'
      await nextTick()
      expect(root.innerHTML).toBe(
        '<section>outlet fallback</section><!--slot-->',
      )

      localText.value = 'stale local fallback'
      outletText.value = 'updated outlet fallback'
      await nextTick()
      expect(root.innerHTML).toBe(
        '<section>updated outlet fallback</section><!--slot-->',
      )

      mode.value = 'local'
      await nextTick()
      expect(root.innerHTML).toBe('<div>stale local fallback</div><!--slot-->')

      mode.value = 'none'
      await nextTick()
      expect(root.innerHTML).toBe(
        '<section>updated outlet fallback</section><!--slot-->',
      )
    })

    test('compiled vdom local fallback keeps outlet fallback clean across invalid updates', async () => {
      const data = ref({
        mode: 'local',
        outlet: 'outlet fallback',
      })
      const VDomOuterSlot = compile(
        `<script setup>const data = _data</script>
        <template>
          <slot name="foo"><section>{{ data.outlet }}</section></slot>
        </template>`,
        data,
        {},
        { vapor: false },
      )
      const VDomInnerSlot = compile(
        `<script setup>
          const data = _data
          const components = _components
        </script>
        <template>
          <components.VDomOuterSlot>
            <template #foo>
              <slot name="bar">
                <span v-if="data.mode === 'local'">local fallback</span>
                <template v-else-if="data.mode === 'empty-a'" />
                <template v-else-if="data.mode === 'empty-b'" />
              </slot>
            </template>
          </components.VDomOuterSlot>
        </template>`,
        data,
        { VDomOuterSlot },
        { vapor: false },
      )
      const VaporBridge = compile(
        `<template>
          <components.VDomInnerSlot>
            <template #bar><slot name="bar" /></template>
          </components.VDomInnerSlot>
        </template>`,
        data,
        { VDomInnerSlot },
      )

      const { html } = define({
        setup() {
          return () => h(VaporBridge as any)
        },
      }).render()

      expect(html()).toBe('<span>local fallback</span>')

      data.value.mode = 'empty-a'
      await nextTick()
      expect(html()).toBe('<section>outlet fallback</section>')

      data.value.mode = 'empty-b'
      await nextTick()
      expect(html()).toBe('<section>outlet fallback</section>')
    })

    test('preserves normalized VDOM slot functions passed to Vapor', async () => {
      const msg = ref('default slot')
      const VaporChild = defineVaporComponent(() => createSlot('default', null))

      const { html } = define({
        setup() {
          return () =>
            h(VaporChild as any, null, {
              default: withCtx(() => [h('span', msg.value)]),
            })
        },
      }).render()

      expect(html()).toBe('<span>default slot</span>')

      msg.value = 'updated'
      await nextTick()
      expect(html()).toBe('<span>updated</span>')
    })

    test('normalizes raw VDOM non-function slot values passed to Vapor', async () => {
      const msg = ref('default slot')
      const VaporChild = defineVaporComponent(() => createSlot('default', null))

      const { html } = define({
        setup() {
          return () =>
            h(VaporChild as any, null, {
              default: h('span', msg.value),
            })
        },
      }).render()

      expect(html()).toBe('<span>default slot</span>')

      msg.value = 'updated'
      await nextTick()
      expect(html()).toBe('<span>updated</span>')
    })

    test('normalizes raw VDOM array children as default Vapor slot', async () => {
      const msg = ref('default slot')
      const VaporChild = defineVaporComponent(() => createSlot('default', null))

      const { html } = define({
        setup() {
          return () => h(VaporChild as any, null, [h('span', msg.value)])
        },
      }).render()

      expect(html()).toBe('<span>default slot</span>')

      msg.value = 'updated'
      await nextTick()
      expect(html()).toBe('<span>updated</span>')
    })

    test('updates dynamically forwarded VDOM slot keys passed to Vapor', async () => {
      const mode = ref<'late' | 'both' | 'none'>('late')
      const Inner = defineVaporComponent(() => [
        createSlot('early', null),
        createSlot('late', null),
        template('<p>after</p>')(),
      ])
      const Forwarder = defineVaporComponent(() => {
        const slots = useSlots()
        return createComponent(Inner, null, {
          $: [
            () =>
              createForSlots(slots, (_slot, name) => ({
                name,
                fn: () => createSlot(name),
              })) as any,
          ],
        })
      })

      const { html } = define({
        setup() {
          return () => {
            const slots: Record<string, () => any> = {}
            if (mode.value === 'both') {
              slots.early = () => h('span', 'early')
            }
            if (mode.value !== 'none') {
              slots.late = () => h('span', 'late')
            }
            return h(Forwarder as any, null, slots)
          }
        },
      }).render()

      expect(html()).toMatchInlineSnapshot(
        `"<!--slot--><span>late</span><!--slot--><p>after</p>"`,
      )

      mode.value = 'both'
      await nextTick()
      expect(html()).toMatchInlineSnapshot(
        `"<span>early</span><!--slot--><span>late</span><!--slot--><p>after</p>"`,
      )

      mode.value = 'none'
      await nextTick()
      expect(html()).toMatchInlineSnapshot(
        `"<!--slot--><!--slot--><p>after</p>"`,
      )
    })

    test('cloneVNode keeps vapor slot instances isolated across prop updates', async () => {
      const left = ref('left')
      const right = ref('right')

      const VDomChild = defineComponent({
        setup(_, { slots }) {
          return () => {
            const slotVNode = renderSlot(slots, 'default', { msg: left.value })
            return h('div', [
              cloneVNode(slotVNode, { key: 'left', msg: left.value }),
              cloneVNode(slotVNode, { key: 'right', msg: right.value }),
            ])
          }
        },
      })

      const VaporChild = defineVaporComponent({
        setup() {
          return createComponent(
            VDomChild as any,
            null,
            {
              default: (props: any) => {
                const span = document.createElement('span')
                renderEffect(() => {
                  span.textContent = props.msg
                })
                return span
              },
            },
            true,
          )
        },
      })

      const root = document.createElement('div')
      createApp(VaporChild as any)
        .use(vaporInteropPlugin)
        .mount(root)
      expect(root.innerHTML).toBe(
        '<div><span>left</span><span>right</span></div>',
      )

      left.value = 'left-2'
      await nextTick()
      expect(root.innerHTML).toBe(
        '<div><span>left-2</span><span>right</span></div>',
      )

      right.value = 'right-2'
      await nextTick()
      expect(root.innerHTML).toBe(
        '<div><span>left-2</span><span>right-2</span></div>',
      )
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

    test('slots.default() delayed by VDOM child should not warn when vapor slot contains v-for', async () => {
      const data = ref(['Vue', 'Vapor'])

      const VDomClientOnly = defineComponent({
        setup(_, { slots }) {
          const show = ref(false)
          onMounted(() => {
            show.value = true
          })
          return () => h('section', null, show.value ? slots.default?.() : [])
        },
      })

      const VaporChild = compile(
        `<template>
          <components.VDomClientOnly>
            <span v-for="item in data" :key="item">{{ item }}</span>
          </components.VDomClientOnly>
        </template>`,
        data,
        {
          VDomClientOnly,
        },
      )

      const { html } = define({
        setup() {
          return () => h(VaporChild as any)
        },
      }).render()

      expect(html()).toBe('<section></section>')

      await nextTick()

      expect(html()).toBe(
        '<section><span>Vue</span><span>Vapor</span><!--for--></section>',
      )
      expect(
        'createFor() can only be used inside setup()',
      ).not.toHaveBeenWarned()
    })

    test('slots.default() access should return a stable wrapper', () => {
      const VDomChild = defineComponent({
        setup(_, { slots }) {
          const first = slots.default
          const second = slots.default
          return () => h('div', String(first === second))
        },
      })

      const VaporChild = defineVaporComponent({
        setup() {
          return createComponent(
            VDomChild as any,
            null,
            {
              default: () => template('stable slot wrapper')(),
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

      expect(html()).toBe('<div>true</div>')
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

    test('slots.default() with falsy slot props should keep has/ownKeys semantics', () => {
      const VDomChild = defineComponent({
        setup(_, { slots }) {
          return () =>
            h('div', null, slots.default!({ flag: false, count: 0, text: '' }))
        },
      })

      const VaporChild = defineVaporComponent({
        setup() {
          return createComponent(
            VDomChild as any,
            null,
            {
              default: (props: Record<string, any>) => {
                const n0 = document.createTextNode(
                  `${'flag' in props}/${'count' in props}/${'text' in props}|` +
                    `${Object.keys(props).join(',')}|` +
                    `${String(props.flag)},${String(props.count)},${String(props.text)}`,
                )
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

      expect(html()).toBe('<div>true/true/true|flag,count,text|false,0,</div>')
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

    test('dynamic slots via createForSlots should update in vdom child', async () => {
      const list = ref([0, 1, 2])

      const VDomChild = defineComponent({
        setup(_, { slots }) {
          return () => h('div', null, [renderSlot(slots, 'default')])
        },
      })

      const VaporParent = defineVaporComponent({
        setup() {
          return createComponent(VDomChild as any, null, {
            $: [
              () =>
                createForSlots(list.value, value => ({
                  name: 'default',
                  fn: () => {
                    const n = template('<span> </span>')() as Element
                    const t = txt(n) as Text
                    renderEffect(() => setText(t, toDisplayString(value)))
                    return n
                  },
                })),
            ],
          })
        },
      })

      const { html } = define({
        setup() {
          return () => h(VaporParent as any)
        },
      }).render()

      // last-wins: shows last item
      expect(html()).toBe('<div><span>2</span></div>')

      list.value.push(3)
      await nextTick()
      expect(html()).toBe('<div><span>3</span></div>')

      list.value.pop()
      list.value.pop()
      await nextTick()
      expect(html()).toBe('<div><span>1</span></div>')
    })

    test('dynamic slots via createForSlots should re-mount fragment slot in vdom child', async () => {
      const list = ref([0, 1, 2])

      const VDomChild = defineComponent({
        setup(_, { slots }) {
          return () => h('div', null, [renderSlot(slots, 'default')])
        },
      })

      const VaporParent = defineVaporComponent({
        setup() {
          return createComponent(VDomChild as any, null, {
            $: [
              () =>
                createForSlots(list.value, value => ({
                  name: 'default',
                  fn: () =>
                    createIf(
                      () => true,
                      () => {
                        const n = template('<span> </span>')() as Element
                        const t = txt(n) as Text
                        renderEffect(() => setText(t, toDisplayString(value)))
                        return n
                      },
                    ),
                })),
            ],
          })
        },
      })

      const { html } = define({
        setup() {
          return () => h(VaporParent as any)
        },
      }).render()

      expect(html()).toBe('<div><span>2</span><!--if--></div>')

      list.value.push(3)
      await nextTick()
      expect(html()).toBe('<div><span>3</span><!--if--></div>')

      list.value.pop()
      list.value.pop()
      await nextTick()
      expect(html()).toBe('<div><span>1</span><!--if--></div>')
    })

    test('dynamic slot re-mount should stop stale effects from previous slot function', async () => {
      const list = ref([0, 1])
      const slotStates = new Map([
        [0, { text: ref('zero'), runs: vi.fn() }],
        [1, { text: ref('one'), runs: vi.fn() }],
        [2, { text: ref('two'), runs: vi.fn() }],
      ])

      const VDomChild = defineComponent({
        setup(_, { slots }) {
          return () => h('div', null, [renderSlot(slots, 'default')])
        },
      })

      const VaporParent = defineVaporComponent({
        setup() {
          return createComponent(VDomChild as any, null, {
            $: [
              () =>
                createForSlots(list.value, value => ({
                  name: 'default',
                  fn: () => {
                    const state = slotStates.get(value)!
                    const n = template('<span> </span>')() as Element
                    const t = txt(n) as Text
                    renderEffect(() => {
                      state.runs()
                      setText(t, state.text.value)
                    })
                    return n
                  },
                })),
            ],
          })
        },
      })

      const { html } = define({
        setup() {
          return () => h(VaporParent as any)
        },
      }).render()

      const firstState = slotStates.get(1)!

      expect(html()).toBe('<div><span>one</span></div>')
      expect(firstState.runs).toHaveBeenCalledTimes(1)

      list.value.push(2)
      await nextTick()

      expect(html()).toBe('<div><span>two</span></div>')
      expect(firstState.runs).toHaveBeenCalledTimes(1)

      firstState.text.value = 'stale-one'
      await nextTick()

      expect(html()).toBe('<div><span>two</span></div>')
      expect(firstState.runs).toHaveBeenCalledTimes(1)
    })

    test('should stop vdom slot outlet effects after outlet unmount', async () => {
      const showOutlet = ref(true)
      const msg = ref('one')
      const track = vi.fn()

      const VaporChild = defineVaporComponent({
        setup() {
          return createIf(
            () => showOutlet.value,
            () => createSlot('default'),
          )
        },
      })

      const { html } = define({
        setup() {
          return () =>
            h(VaporChild as any, null, {
              default: () => {
                track()
                return [h('span', msg.value)]
              },
            })
        },
      }).render()

      expect(html()).toBe('<span>one</span><!--if-->')
      expect(track).toHaveBeenCalledTimes(1)

      showOutlet.value = false
      await nextTick()
      expect(html()).toBe('<!--if-->')

      msg.value = 'two'
      await nextTick()

      expect(track).toHaveBeenCalledTimes(1)
      expect(html()).toBe('<!--if-->')
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

    it('dynamic component includes vdom component', async () => {
      const vdomRef = ref<any>(null)
      const VdomChild = defineComponent({
        setup(_, { expose }) {
          expose({ name: 'vdomChild' })
          return () => h('div', 'vdom child')
        },
      })

      const VaporChild = defineVaporComponent({
        setup() {
          return { vdomRef }
        },
        render() {
          const setRef = createTemplateRefSetter()
          const n0 = createDynamicComponent(() => VdomChild)
          setRef(n0, vdomRef, false, 'vdomRef')
          return n0
        },
      })

      define({
        setup() {
          return () => h(VaporChild as any)
        },
      }).render()

      await nextTick()
      expect(vdomRef.value).toBeDefined()
      expect(vdomRef.value.name).toBe('vdomChild')
    })

    it('dynamic component includes vdom component should unmount with vapor branch', async () => {
      const show = ref(true)
      const unmounted = vi.fn()
      const VdomChild = defineComponent({
        setup() {
          onUnmounted(unmounted)
          return () => h('div', 'vdom child')
        },
      })

      const VaporChild = defineVaporComponent({
        setup() {
          return createIf(
            () => show.value,
            () => createDynamicComponent(() => VdomChild),
          )
        },
      })

      const { html } = define({
        setup() {
          return () => h(VaporChild as any)
        },
      }).render()

      expect(html()).toContain('<div>vdom child</div>')

      show.value = false
      await nextTick()

      expect(unmounted).toHaveBeenCalledTimes(1)
      expect(html()).not.toContain('vdom child')
    })

    it('dynamic component includes vdom component should cleanup old ref', async () => {
      const VdomChild = defineComponent({
        setup(_, { expose }) {
          expose({ name: 'vdomChild' })
          return () => h('div', 'vdom child')
        },
      })

      const useA = ref(true)
      const refA = ref<any>(null)
      const refB = ref<any>(null)

      const VaporChild = defineVaporComponent({
        setup() {
          const setRef = createTemplateRefSetter()
          const n0 = createDynamicComponent(() => VdomChild)
          renderEffect(() => {
            setRef(n0, useA.value ? refA : refB, false, 'vdomRef')
          })
          return n0
        },
      })

      define({
        setup() {
          return () => h(VaporChild as any)
        },
      }).render()

      await nextTick()
      expect(refA.value).toBeDefined()
      expect(refA.value.name).toBe('vdomChild')
      expect(refB.value).toBe(null)

      useA.value = false
      await nextTick()
      expect(refA.value).toBe(null)
      expect(refB.value).toBeDefined()
      expect(refB.value.name).toBe('vdomChild')
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

        it('unmounts cached inner VDOM components', async () => {
          const hooksA = {
            unmounted: vi.fn(),
          }
          const hooksB = {
            unmounted: vi.fn(),
          }

          const VDOMCompA = defineComponent({
            setup() {
              onUnmounted(() => hooksA.unmounted())
              return () => h('div', 'vdom A')
            },
          })

          const VDOMCompB = defineComponent({
            setup() {
              onUnmounted(() => hooksB.unmounted())
              return () => h('div', 'vdom B')
            },
          })

          const current = shallowRef<any>(VDOMCompA)

          const App = defineVaporComponent({
            setup() {
              return createComponent(VaporKeepAlive, null, {
                default: () => createDynamicComponent(() => current.value),
              })
            },
          })

          const root = document.createElement('div')
          const app = createApp({
            setup() {
              return () => h(App as any)
            },
          })
          app.use(vaporInteropPlugin)
          app.mount(root)

          expect(root.innerHTML).toBe(
            '<div>vdom A</div><!--dynamic-component-->',
          )

          current.value = VDOMCompB
          await nextTick()
          expect(root.innerHTML).toBe(
            '<div>vdom B</div><!--dynamic-component-->',
          )
          expect(hooksA.unmounted).toHaveBeenCalledTimes(0)
          expect(hooksB.unmounted).toHaveBeenCalledTimes(0)

          app.unmount()
          await nextTick()
          expect(hooksA.unmounted).toHaveBeenCalledTimes(1)
          expect(hooksB.unmounted).toHaveBeenCalledTimes(1)
        })

        it('unmounts inactive cached inner VDOM components during KeepAlive hmr rerender', async () => {
          const hooksA = {
            unmounted: vi.fn(),
          }
          const hooksB = {
            unmounted: vi.fn(),
          }

          const VDOMCompA = defineComponent({
            setup() {
              onUnmounted(() => hooksA.unmounted())
              return () => h('div', 'vdom A')
            },
          })

          const VDOMCompB = defineComponent({
            setup() {
              onUnmounted(() => hooksB.unmounted())
              return () => h('div', 'vdom B')
            },
          })

          const current = shallowRef<any>(VDOMCompA)
          let keepAlive: any

          const App = defineVaporComponent({
            setup() {
              keepAlive = createComponent(VaporKeepAlive, null, {
                default: () => createDynamicComponent(() => current.value),
              })
              return keepAlive
            },
          })

          const { html } = define({
            setup() {
              return () => h(App as any)
            },
          }).render()

          expect(html()).toBe('<div>vdom A</div><!--dynamic-component-->')

          current.value = VDOMCompB
          await nextTick()
          expect(html()).toBe('<div>vdom B</div><!--dynamic-component-->')
          expect(hooksA.unmounted).toHaveBeenCalledTimes(0)
          expect(hooksB.unmounted).toHaveBeenCalledTimes(0)

          keepAlive.hmrRerender()
          await nextTick()

          expect(hooksA.unmounted).toHaveBeenCalledTimes(1)
          expect(hooksB.unmounted).toHaveBeenCalledTimes(1)
          expect(html()).toBe('<div>vdom B</div><!--dynamic-component-->')
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

    it('should update attrs passed from vapor parent to vdom child', async () => {
      const msg = ref('foo')

      const VDomChild = defineComponent({
        setup(_, { attrs }) {
          return () =>
            h(
              'div',
              {
                'data-msg': attrs['data-msg'] as string,
              },
              attrs['data-msg'] as string,
            )
        },
      })

      const VaporChild = defineVaporComponent({
        setup() {
          return createComponent(
            VDomChild as any,
            {
              'data-msg': () => msg.value,
            },
            null,
            true,
          )
        },
      })

      const { html } = define({
        setup() {
          return () => h(VaporChild as any)
        },
      }).render()

      expect(html()).toBe('<div data-msg="foo">foo</div>')
      msg.value = 'bar'
      await nextTick()
      expect(html()).toBe('<div data-msg="bar">bar</div>')
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

  describe('KeepAlive', () => {
    const VDomCommentWrapper = defineComponent({
      setup(_, { slots }) {
        return () => [
          createCommentVNode('before'),
          renderSlot(slots, 'default'),
          createCommentVNode('after'),
        ]
      },
    })

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

          const n0 = template('<input type="text">', 1)() as any
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

    test('render vapor slot', async () => {
      const show = ref(true)

      const VDomComp = defineComponent({
        setup(_, { slots }) {
          return () => renderSlot(slots, 'default')
        },
      })
      const App = defineVaporComponent({
        setup() {
          const n5 = createComponent(VaporKeepAlive, null, {
            default: () =>
              createIf(
                () => show.value,
                () =>
                  createComponent(VDomComp as any, null, {
                    default: () => template('slot text')(),
                  }),
              ),
          })
          return n5
        },
      })

      const { html } = define({
        setup() {
          return () => h(App)
        },
      }).render()

      expect(html()).toBe('slot text<!--if-->')
      show.value = false
      await nextTick()
      expect(html()).toBe('<!--if-->')
      show.value = true
      await nextTick()
      expect(html()).toBe('slot text<!--if-->')
    })

    test('vdom slot fallback inside VaporKeepAlive should preserve render context', async () => {
      const show = ref(true)

      const VDomComp = defineComponent({
        setup(_, { slots }) {
          return () => renderSlot(slots, 'default')
        },
      })

      const VaporFallback = defineVaporComponent({
        setup() {
          onBeforeMount(() => hooks.beforeMount())
          onMounted(() => hooks.mounted())
          onActivated(() => hooks.activated())
          onDeactivated(() => hooks.deactivated())
          onUnmounted(() => hooks.unmounted())
          return template('<div>fallback</div>')() as any
        },
      })

      const App = defineVaporComponent({
        setup() {
          return createComponent(VaporKeepAlive, null, {
            default: () =>
              createIf(
                () => show.value,
                () =>
                  createComponent(
                    VDomComp as any,
                    null,
                    {
                      default: () =>
                        createSlot('default', null, () =>
                          createComponent(VaporFallback as any),
                        ),
                    },
                    true,
                  ),
              ),
          })
        },
      })

      const { html } = define({
        setup() {
          return () => h(App)
        },
      }).render()

      expect(html()).toBe('<div>fallback</div><!--if-->')
      assertHookCalls(hooks, [1, 1, 1, 0, 0])

      show.value = false
      await nextTick()
      expect(html()).toBe('<!--if-->')
      assertHookCalls(hooks, [1, 1, 1, 1, 0])

      show.value = true
      await nextTick()
      expect(html()).toBe('<div>fallback</div><!--if-->')
      assertHookCalls(hooks, [1, 1, 2, 1, 0])
    })

    test('unmounting vapor slot should remove vnode slot content', async () => {
      const show = ref(true)

      const VaporSlotOutlet = defineVaporComponent({
        setup() {
          return createSlot('default')
        },
      })

      const { html } = define({
        setup() {
          return () =>
            h('div', null, [
              show.value
                ? h(VaporSlotOutlet as any, null, {
                    default: () => [h('span', 'slot vnode')],
                  })
                : null,
            ])
        },
      }).render()

      expect(html()).toBe('<div><span>slot vnode</span></div>')
      show.value = false
      await nextTick()
      expect(html()).toBe('<div><!----></div>')
    })

    test('should remove teleported slot content when unmounting comment-wrapped vdom slot inside VaporKeepAlive', async () => {
      const show = ref(true)
      const target = document.createElement('div')
      target.id = 'keepalive-teleport-target'
      document.body.appendChild(target)

      const App = defineVaporComponent({
        setup() {
          return createIf(
            () => show.value,
            () =>
              createComponent(VDomCommentWrapper as any, null, {
                default: () =>
                  createComponent(VaporKeepAlive, null, {
                    default: () =>
                      createComponent(
                        VaporTeleport,
                        { to: () => '#keepalive-teleport-target' },
                        {
                          default: () => template('<input>')(),
                        },
                      ),
                  }),
              }),
          )
        },
      })

      const host = document.createElement('div')
      const app = createVaporApp(App)
      app.use(vaporInteropPlugin)
      app.mount(host)

      try {
        await nextTick()
        expect(target.innerHTML).toBe('<input>')

        show.value = false
        await nextTick()

        expect(target.innerHTML).toBe('')
      } finally {
        app.unmount()
        host.remove()
        target.remove()
      }
    })

    test('should remove inline teleported slot content when disabled inside comment-wrapped vdom slot under VaporKeepAlive', async () => {
      const show = ref(true)
      const target = document.createElement('div')
      target.id = 'keepalive-disabled-teleport-target'
      document.body.appendChild(target)

      const App = defineVaporComponent({
        setup() {
          return createIf(
            () => show.value,
            () =>
              createComponent(VDomCommentWrapper as any, null, {
                default: () =>
                  createComponent(VaporKeepAlive, null, {
                    default: () =>
                      createComponent(
                        VaporTeleport,
                        {
                          to: () => '#keepalive-disabled-teleport-target',
                          disabled: () => true,
                        },
                        {
                          default: () => template('<input>')(),
                        },
                      ),
                  }),
              }),
          )
        },
      })

      const host = document.createElement('div')
      const app = createVaporApp(App)
      app.use(vaporInteropPlugin)
      app.mount(host)

      try {
        await nextTick()
        expect(host.querySelector('input')).not.toBeNull()
        expect(target.innerHTML).toBe('')

        show.value = false
        await nextTick()

        expect(host.querySelector('input')).toBeNull()
        expect(target.innerHTML).toBe('')
      } finally {
        app.unmount()
        host.remove()
        target.remove()
      }
    })

    test('should remove moved teleported slot content when comment-wrapped vdom slot under VaporKeepAlive unmounts', async () => {
      const show = ref(true)
      const to = ref('#keepalive-teleport-target-a')
      const targetA = document.createElement('div')
      targetA.id = 'keepalive-teleport-target-a'
      const targetB = document.createElement('div')
      targetB.id = 'keepalive-teleport-target-b'
      document.body.append(targetA, targetB)

      const App = defineVaporComponent({
        setup() {
          return createIf(
            () => show.value,
            () =>
              createComponent(VDomCommentWrapper as any, null, {
                default: () =>
                  createComponent(VaporKeepAlive, null, {
                    default: () =>
                      createComponent(
                        VaporTeleport,
                        { to: () => to.value },
                        {
                          default: () => template('<input>')(),
                        },
                      ),
                  }),
              }),
          )
        },
      })

      const host = document.createElement('div')
      const app = createVaporApp(App)
      app.use(vaporInteropPlugin)
      app.mount(host)

      try {
        await nextTick()
        expect(targetA.innerHTML).toBe('<input>')
        expect(targetB.innerHTML).toBe('')

        to.value = '#keepalive-teleport-target-b'
        await nextTick()

        expect(targetA.innerHTML).toBe('')
        expect(targetB.innerHTML).toBe('<input>')

        show.value = false
        await nextTick()

        expect(targetA.innerHTML).toBe('')
        expect(targetB.innerHTML).toBe('')
      } finally {
        app.unmount()
        host.remove()
        targetA.remove()
        targetB.remove()
      }
    })

    test('should remove teleported slot content when KeepAlive is nested inside a vapor wrapper in comment-wrapped vdom slot', async () => {
      const show = ref(true)
      const target = document.createElement('div')
      target.id = 'nested-keepalive-teleport-target'
      document.body.appendChild(target)

      const NestedKeepAlive = defineVaporComponent({
        setup() {
          return createComponent(VaporKeepAlive, null, {
            default: () => createSlot('default'),
          })
        },
      })

      const App = defineVaporComponent({
        setup() {
          return createIf(
            () => show.value,
            () =>
              createComponent(VDomCommentWrapper as any, null, {
                default: () =>
                  createComponent(NestedKeepAlive, null, {
                    default: () =>
                      createComponent(
                        VaporTeleport,
                        { to: () => '#nested-keepalive-teleport-target' },
                        {
                          default: () => template('<input>')(),
                        },
                      ),
                  }),
              }),
          )
        },
      })

      const host = document.createElement('div')
      const app = createVaporApp(App)
      app.use(vaporInteropPlugin)
      app.mount(host)

      try {
        await nextTick()
        expect(target.innerHTML).toBe('<input>')

        show.value = false
        await nextTick()

        expect(target.innerHTML).toBe('')
      } finally {
        app.unmount()
        host.remove()
        target.remove()
      }
    })

    test('should remove teleported content when unmounting comment-wrapped vdom vapor child inside VaporKeepAlive', async () => {
      const show = ref(true)
      const target = document.createElement('div')
      target.id = 'comment-wrapped-vdom-vapor-child-teleport-target'
      document.body.appendChild(target)

      const VaporChild = defineVaporComponent({
        setup() {
          return createComponent(VaporKeepAlive, null, {
            default: () =>
              createComponent(
                VaporTeleport,
                {
                  to: () => '#comment-wrapped-vdom-vapor-child-teleport-target',
                },
                {
                  default: () => template('<input>')(),
                },
              ),
          })
        },
      })

      const App = defineComponent({
        setup() {
          return () =>
            h('div', null, [
              show.value
                ? h(VDomCommentWrapper as any, null, {
                    default: () => h(VaporChild as any),
                  })
                : null,
            ])
        },
      })

      const host = document.createElement('div')
      const app = createApp(App)
      app.use(vaporInteropPlugin)
      app.mount(host)

      try {
        await nextTick()
        expect(target.innerHTML).toBe('<input>')

        show.value = false
        await nextTick()

        expect(target.innerHTML).toBe('')
      } finally {
        app.unmount()
        host.remove()
        target.remove()
      }
    })

    test('should update props on reactivation of vapor child in vdom KeepAlive', async () => {
      const VaporChild = defineVaporComponent({
        props: { msg: String },
        setup(props: any) {
          const n0 = template('<div> </div>')() as any
          const x0 = child(n0) as any
          renderEffect(() => setText(x0, props.msg))
          return n0
        },
      })

      const VdomChild = defineComponent({
        setup() {
          return () => h('span', 'vdom')
        },
      })

      const current = shallowRef<any>(VaporChild)
      const msg = ref('hello')

      const App = defineComponent({
        setup() {
          return () =>
            h(KeepAlive, null, {
              default: () =>
                h(
                  resolveDynamicComponent(current.value) as any,
                  current.value === VaporChild ? { msg: msg.value } : null,
                ),
            })
        },
      })

      const root = document.createElement('div')
      const app = createApp(App)
      app.use(vaporInteropPlugin)
      app.mount(root)

      expect(root.innerHTML).toBe('<div>hello</div>')

      // Switch to vdom child (deactivates vapor child)
      current.value = VdomChild
      await nextTick()
      expect(root.innerHTML).toBe('<span>vdom</span>')

      // Change props while vapor child is deactivated
      msg.value = 'updated'
      await nextTick()
      expect(root.innerHTML).toBe('<span>vdom</span>')

      // Reactivate vapor child — should reflect new props
      current.value = VaporChild
      await nextTick()
      expect(root.innerHTML).toBe('<div>updated</div>')
    })

    test('should invoke vnode hooks on activate/deactivate', async () => {
      const VaporChild = defineVaporComponent({
        setup() {
          return template('<div>vapor</div>')()
        },
      })

      const VdomChild = defineComponent({
        setup() {
          return () => h('span', 'vdom')
        },
      })

      const current = shallowRef<any>(VaporChild)
      const vnodeMounted = vi.fn()
      const vnodeUnmounted = vi.fn()

      const App = defineComponent({
        setup() {
          return () =>
            h(KeepAlive, null, {
              default: () =>
                h(
                  resolveDynamicComponent(current.value) as any,
                  current.value === VaporChild
                    ? {
                        onVnodeMounted: vnodeMounted,
                        onVnodeUnmounted: vnodeUnmounted,
                      }
                    : null,
                ),
            })
        },
      })

      const root = document.createElement('div')
      const app = createApp(App)
      app.use(vaporInteropPlugin)
      app.mount(root)
      await nextTick()

      expect(vnodeMounted).toHaveBeenCalledTimes(1)
      expect(vnodeUnmounted).toHaveBeenCalledTimes(0)

      // Deactivate vapor child
      current.value = VdomChild
      await nextTick()
      expect(vnodeUnmounted).toHaveBeenCalledTimes(1)

      // Reactivate vapor child
      current.value = VaporChild
      await nextTick()
      expect(vnodeMounted).toHaveBeenCalledTimes(2)
    })

    test('should invoke update hooks in VDOM order on reactivation', async () => {
      const VaporChild = defineVaporComponent({
        props: ['msg'],
        setup(props: any) {
          return template('<div></div>')()
        },
      })

      const VdomChild = defineComponent({
        setup() {
          return () => h('span', 'vdom')
        },
      })

      const current = shallowRef<any>(VaporChild)
      const msg = ref('hello')
      const calls: string[] = []
      const vDir = {
        beforeUpdate: vi.fn(() => calls.push('directive beforeUpdate')),
        updated: vi.fn(() => calls.push('directive updated')),
      }

      const App = defineComponent({
        setup() {
          return () =>
            h(KeepAlive, null, {
              default: () =>
                current.value === VaporChild
                  ? withDirectives(
                      h(VaporChild as any, {
                        msg: msg.value,
                        onVnodeBeforeUpdate: () =>
                          calls.push('vnode beforeUpdate'),
                        onVnodeUpdated: () => calls.push('vnode updated'),
                      }),
                      [[vDir]],
                    )
                  : h(VdomChild),
            })
        },
      })

      const root = document.createElement('div')
      const app = createApp(App)
      app.use(vaporInteropPlugin)
      app.mount(root)
      await nextTick()

      // Deactivate vapor child
      current.value = VdomChild
      await nextTick()

      // Change props while deactivated
      msg.value = 'world'

      // Reactivate — should trigger update hooks
      current.value = VaporChild
      await nextTick()
      expect(calls).toEqual([
        'vnode beforeUpdate',
        'directive beforeUpdate',
        'directive updated',
        'vnode updated',
      ])
    })

    test('should invoke updated before activated on reactivation', async () => {
      const calls: string[] = []

      const VaporChild = defineVaporComponent({
        props: ['msg'],
        setup(props: any) {
          onActivated(() => calls.push('activated'))
          return template('<div></div>')()
        },
      })

      const VdomChild = defineComponent({
        setup() {
          return () => h('span', 'vdom')
        },
      })

      const current = shallowRef<any>(VaporChild)
      const msg = ref('one')

      const App = defineComponent({
        setup() {
          return () =>
            h(KeepAlive, null, {
              default: () =>
                current.value === VaporChild
                  ? h(VaporChild as any, {
                      msg: msg.value,
                      onVnodeUpdated: () => calls.push('vnode updated'),
                      onVnodeMounted: () => calls.push('vnode mounted'),
                    })
                  : h(VdomChild),
            })
        },
      })

      const root = document.createElement('div')
      const app = createApp(App)
      app.use(vaporInteropPlugin)
      app.mount(root)
      await nextTick()
      calls.length = 0

      current.value = VdomChild
      await nextTick()

      msg.value = 'two'
      current.value = VaporChild
      await nextTick()

      expect(calls).toEqual(['vnode updated', 'activated', 'vnode mounted'])
    })

    test('should expose the latest vapor root element in updated hooks on reactivation', async () => {
      const VaporChild = defineVaporComponent({
        props: {
          alt: Boolean,
        },
        setup(props: any) {
          return createIf(
            () => props.alt,
            () => template('<p>alt</p>')(),
            () => template('<div>base</div>')(),
          )
        },
      })

      const VdomChild = defineComponent({
        setup() {
          return () => h('span', 'vdom')
        },
      })

      const current = shallowRef<any>(VaporChild)
      const useAltRoot = ref(false)
      const updatedSpy = vi.fn((vnode: any) => {
        expect((vnode.el as Element).tagName).toBe('P')
      })

      const App = defineComponent({
        setup() {
          return () =>
            h(KeepAlive, null, {
              default: () =>
                current.value === VaporChild
                  ? h(VaporChild as any, {
                      alt: useAltRoot.value,
                      onVnodeUpdated: updatedSpy,
                    })
                  : h(VdomChild),
            })
        },
      })

      const root = document.createElement('div')
      const app = createApp(App)
      app.use(vaporInteropPlugin)
      app.mount(root)
      await nextTick()

      current.value = VdomChild
      await nextTick()

      useAltRoot.value = true
      current.value = VaporChild
      await nextTick()

      expect(root.querySelector('p')).not.toBeNull()
      expect(updatedSpy).toHaveBeenCalledTimes(1)
    })

    test('should bail out directive beforeUpdate/updated on reactivation for non-element root vapor child', async () => {
      const beforeUpdateSpy = vi.fn()
      const updatedSpy = vi.fn()

      const vDir = {
        beforeUpdate: beforeUpdateSpy,
        updated: updatedSpy,
      }

      const VaporChild = defineVaporComponent({
        props: ['msg'],
        setup() {
          return [template('<div></div>')(), template('<div></div>')()]
        },
      })

      const VdomChild = defineComponent({
        setup() {
          return () => h('span', 'vdom')
        },
      })

      const current = shallowRef<any>(VaporChild)
      const msg = ref('hello')

      const App = defineComponent({
        setup() {
          return () =>
            h(KeepAlive, null, {
              default: () =>
                current.value === VaporChild
                  ? withDirectives(h(VaporChild as any, { msg: msg.value }), [
                      [vDir],
                    ])
                  : h(VdomChild),
            })
        },
      })

      const root = document.createElement('div')
      const app = createApp(App)
      app.use(vaporInteropPlugin)
      app.mount(root)
      await nextTick()

      if (__DEV__) {
        expect(
          `Runtime directive used on component with non-element root node.`,
        ).toHaveBeenWarnedTimes(1)
      }
      expect(beforeUpdateSpy).toHaveBeenCalledTimes(0)
      expect(updatedSpy).toHaveBeenCalledTimes(0)

      current.value = VdomChild
      await nextTick()

      msg.value = 'world'
      current.value = VaporChild
      await nextTick()

      expect(
        `Runtime directive used on component with non-element root node.`,
      ).toHaveBeenWarnedTimes(2)
      expect(beforeUpdateSpy).toHaveBeenCalledTimes(0)
      expect(updatedSpy).toHaveBeenCalledTimes(0)
    })
  })

  describe('Teleport', () => {
    test('mounts VDOM Teleport from createDynamicComponent', async () => {
      const target = document.createElement('div')
      target.id = 'interop-teleport-target'
      document.body.appendChild(target)

      try {
        const VaporChild = defineVaporComponent({
          setup() {
            return createDynamicComponent(
              () => Teleport,
              { to: () => '#interop-teleport-target' },
              {
                default: () => template('<span>teleported</span>')(),
              },
              VaporDynamicComponentFlags.SINGLE_ROOT,
            )
          },
        })

        define({
          setup() {
            return () => h(VaporChild as any)
          },
        }).render()

        await nextTick()
        expect(target.innerHTML).toContain('<span>teleported</span>')
      } finally {
        target.remove()
      }
    })

    test('should patch vdom slot content in the new teleport target after move', async () => {
      const targetA = document.createElement('div')
      targetA.id = 'interop-slot-target-a'
      const targetB = document.createElement('div')
      targetB.id = 'interop-slot-target-b'
      document.body.append(targetA, targetB)

      const to = ref('#interop-slot-target-a')
      const useAltRoot = ref(false)

      try {
        const VaporChild = defineVaporComponent({
          setup() {
            return createComponent(
              VaporTeleport,
              {
                to: () => to.value,
              },
              {
                default: () => createSlot('default'),
              },
            )
          },
        })

        const App = defineComponent({
          setup() {
            return () =>
              h(VaporChild as any, null, {
                default: () => [
                  useAltRoot.value ? h('p', 'moved') : h('div', 'initial'),
                ],
              })
          },
        })

        const host = document.createElement('div')
        const app = createApp(App)
        app.use(vaporInteropPlugin)
        app.mount(host)
        await nextTick()

        expect(targetA.innerHTML).toBe('<div>initial</div>')
        expect(targetB.innerHTML).toBe('')

        to.value = '#interop-slot-target-b'
        await nextTick()

        expect(targetA.innerHTML).toBe('')
        expect(targetB.innerHTML).toBe('<div>initial</div>')

        useAltRoot.value = true
        await nextTick()

        expect(targetA.innerHTML).toBe('')
        expect(targetB.innerHTML).toBe('<p>moved</p>')
      } finally {
        targetA.remove()
        targetB.remove()
      }
    })

    test('keeps slot fallback before slot anchor after teleport move and fallback update', async () => {
      const targetA = document.createElement('div')
      targetA.id = 'interop-slot-fallback-target-a'
      const targetB = document.createElement('div')
      targetB.id = 'interop-slot-fallback-target-b'
      document.body.append(targetA, targetB)

      const to = ref('#interop-slot-fallback-target-a')
      const fallbackText = ref('fallback A')

      try {
        const VDomSlotOutlet = defineComponent({
          setup(_, { slots }) {
            return () =>
              renderSlot(slots, 'default', {}, () => [
                h('div', fallbackText.value),
              ])
          },
        })

        const VaporChild = defineVaporComponent({
          setup() {
            return createComponent(
              VaporTeleport,
              {
                to: () => to.value,
              },
              {
                default: () =>
                  createComponent(
                    VDomSlotOutlet as any,
                    null,
                    {
                      default: () => createSlot('default'),
                    },
                    true,
                  ),
              },
            )
          },
        })

        const host = document.createElement('div')
        const app = createApp({
          render: () => h(VaporChild as any),
        })
        app.use(vaporInteropPlugin)
        app.mount(host)
        await nextTick()

        expect(targetA.innerHTML).toBe('<div>fallback A</div>')
        expect(targetB.innerHTML).toBe('')

        to.value = '#interop-slot-fallback-target-b'
        await nextTick()

        expect(targetA.innerHTML).toBe('')
        expect(targetB.innerHTML).toBe('<div>fallback A</div>')

        fallbackText.value = 'fallback B'
        await nextTick()

        expect(targetA.innerHTML).toBe('')
        expect(targetB.innerHTML).toBe('<div>fallback B</div>')
      } finally {
        targetA.remove()
        targetB.remove()
      }
    })
  })

  describe('Suspense', () => {
    test('renders vapor async wrapper inside VDOM Suspense', async () => {
      const duration = 5

      const VaporAsyncChild = defineVaporAsyncComponent({
        loader: () =>
          new Promise(resolve => {
            setTimeout(() => {
              resolve(
                defineVaporComponent({
                  setup() {
                    return template('<div><button>click</button></div>')()
                  },
                }) as any,
              )
            }, duration)
          }),
      })

      const VaporParent = defineVaporComponent({
        setup() {
          return createComponent(
            Suspense as any,
            null,
            {
              default: () => createComponent(VaporAsyncChild, null, null, true),
              fallback: () => template('loading')(),
            },
            true,
          )
        },
      })

      const { html } = define({
        setup() {
          return () => h(VaporParent as any)
        },
      }).render()

      expect(html()).toContain('loading')

      await new Promise(resolve => setTimeout(resolve, duration + 1))
      await nextTick()

      expect(html()).toContain('<div><button>click</button></div>')
    })

    test('does not suspend vapor async wrapper with suspensible false inside VDOM Suspense', async () => {
      const duration = 5

      const VaporAsyncChild = defineVaporAsyncComponent({
        loader: () =>
          new Promise(resolve => {
            setTimeout(() => {
              resolve(
                defineVaporComponent({
                  setup() {
                    return template('<div><button>click</button></div>')()
                  },
                }) as any,
              )
            }, duration)
          }),
        suspensible: false,
      })

      const VaporParent = defineVaporComponent({
        setup() {
          return createComponent(
            Suspense as any,
            null,
            {
              default: () => createComponent(VaporAsyncChild, null, null, true),
              fallback: () => template('loading')(),
            },
            true,
          )
        },
      })

      const { html } = define({
        setup() {
          return () => h(VaporParent as any)
        },
      }).render()

      expect(html()).not.toContain('loading')
      expect(html()).toContain('<!--async component-->')

      await new Promise(resolve => setTimeout(resolve, duration + 1))
      await nextTick()

      expect(html()).toContain('<div><button>click</button></div>')
    })

    test('renders error component for vapor async wrapper inside VDOM Suspense', async () => {
      const tick = () => new Promise(resolve => setTimeout(resolve))

      let reject!: (error: Error) => void
      const VaporAsyncChild = defineVaporAsyncComponent({
        loader: () =>
          new Promise((_resolve, _reject) => {
            reject = _reject as (error: Error) => void
          }),
        errorComponent: defineVaporComponent({
          props: ['error'],
          setup(props: { error: Error }) {
            return template(props.error.message)()
          },
        }),
      })

      const VaporParent = defineVaporComponent({
        setup() {
          return createComponent(
            Suspense as any,
            null,
            {
              default: () => createComponent(VaporAsyncChild, null, null, true),
              fallback: () => template('loading')(),
            },
            true,
          )
        },
      })

      const host = document.createElement('div')
      const app = createApp({
        render: () => h(VaporParent as any),
      })
      const errorHandler = vi.fn()
      app.use(vaporInteropPlugin)
      app.config.errorHandler = errorHandler
      try {
        app.mount(host)

        expect(host.innerHTML).toContain('loading')

        reject(new Error('errored out'))
        await tick()
        await nextTick()

        expect(errorHandler).toHaveBeenCalled()
        expect(host.innerHTML).toContain('errored out')
      } finally {
        app.unmount()
        host.remove()
      }
    })

    test('does not fall through slots to error component for vapor async wrapper inside VDOM Suspense', async () => {
      const tick = () => new Promise(resolve => setTimeout(resolve))

      let reject!: (error: Error) => void
      const VaporAsyncChild = defineVaporAsyncComponent({
        loader: () =>
          new Promise((_resolve, _reject) => {
            reject = _reject as (error: Error) => void
          }),
        errorComponent: defineVaporComponent({
          setup() {
            const n0 = template('<div>error</div>')()
            insert(createSlot('default'), n0 as any as ParentNode)
            return n0
          },
        }),
      })

      const VaporParent = defineVaporComponent({
        setup() {
          return createComponent(
            Suspense as any,
            null,
            {
              default: () =>
                createComponent(
                  VaporAsyncChild,
                  null,
                  {
                    default: () => template('<span>slot content</span>')(),
                  },
                  true,
                ),
              fallback: () => template('loading')(),
            },
            true,
          )
        },
      })

      const host = document.createElement('div')
      const app = createApp({
        render: () => h(VaporParent as any),
      })
      app.use(vaporInteropPlugin)
      const errorHandler = vi.fn()
      app.config.errorHandler = errorHandler
      try {
        app.mount(host)

        expect(host.innerHTML).toContain('loading')

        reject(new Error('errored out'))
        await tick()
        await nextTick()

        expect(errorHandler).toHaveBeenCalled()
        expect(host.innerHTML).toContain('error')
        expect(host.innerHTML).not.toContain('slot content')
      } finally {
        app.unmount()
        host.remove()
      }
    })

    test('renders async setup vapor component inside VDOM Suspense', async () => {
      const duration = 5

      const VaporAsyncChild = defineVaporComponent({
        async setup() {
          await new Promise(resolve => setTimeout(resolve, duration))
          return template('<div><button>click</button></div>')()
        },
      })

      const VaporParent = defineVaporComponent({
        setup() {
          return createComponent(
            Suspense as any,
            null,
            {
              default: () => createComponent(VaporAsyncChild, null, null, true),
              fallback: () => template('loading')(),
            },
            true,
          )
        },
      })

      const { html } = define({
        setup() {
          return () => h(VaporParent as any)
        },
      }).render()

      expect(html()).toContain('loading')

      await new Promise(resolve => setTimeout(resolve, duration + 1))
      await nextTick()

      expect(html()).toContain('<div><button>click</button></div>')
    })

    test('preserves render context for setup-returned helpers after async setup resumes', async () => {
      const duration = 5

      const Resolved = defineVaporComponent({
        setup() {
          return template('<div>resolved</div>')()
        },
      })

      const VaporAsyncChild = defineVaporComponent({
        components: {
          Page: Resolved,
        },
        async setup() {
          await new Promise(resolve => setTimeout(resolve, duration))
          function resolveLayout(name: string) {
            const component = resolveComponent(name)
            return typeof component === 'string' ? null : component
          }
          return { resolveLayout }
        },
        render(_ctx: any) {
          const Page = _ctx.resolveLayout('page')
          return Page ? createComponent(Page, null, null, true) : []
        },
      })

      const { html } = define({
        render() {
          return h(Suspense as any, null, {
            default: () => h(VaporAsyncChild as any),
            fallback: () => h('span', 'loading'),
          })
        },
      }).render()

      expect(html()).toContain('<span>loading</span>')

      await new Promise(resolve => setTimeout(resolve, duration + 1))
      await nextTick()

      expect(html()).toContain('<div>resolved</div>')
      expect(
        'resolveComponent can only be used in render() or setup()',
      ).not.toHaveBeenWarned()
    })

    test('render effects created in render() after async setup are owned by the instance', async () => {
      const duration = 5
      const msg = ref('pending')
      let instanceInRender: any

      const VaporAsyncChild = defineVaporComponent({
        async setup() {
          let __temp: any, __restore: any
          ;(([__temp, __restore] = withAsyncContext(
            () => new Promise(resolve => setTimeout(resolve, duration)),
          )),
            (__temp = await __temp),
            __restore())
          return { msg }
        },
        render(_ctx: any) {
          instanceInRender = currentInstance
          const n = template('<div> </div>')()
          const x = child(n as any) as any
          renderEffect(() => setText(x, toDisplayString(_ctx.msg)))
          return n
        },
      })

      const { html } = define({
        render() {
          return h(Suspense as any, null, {
            default: () => h(VaporAsyncChild as any),
            fallback: () => h('span', 'loading'),
          })
        },
      }).render()

      expect(html()).toContain('<span>loading</span>')

      await new Promise(resolve => setTimeout(resolve, duration + 1))
      await nextTick()

      expect(html()).toContain('<div>pending</div>')
      expect(instanceInRender).not.toBe(null)

      msg.value = 'updated'
      await nextTick()
      expect(html()).toContain('<div>updated</div>')
    })

    test('renders async VDOM child inside VDOM Suspense', async () => {
      const duration = 5

      const VDomAsyncChild = defineComponent({
        async setup() {
          await new Promise(resolve => setTimeout(resolve, duration))
          return () => h('div', [h('button', 'click')])
        },
      })

      const VaporParent = defineVaporComponent({
        setup() {
          return createComponent(
            Suspense as any,
            null,
            {
              default: () =>
                createComponent(VDomAsyncChild as any, null, null, true),
              fallback: () => template('loading')(),
            },
            true,
          )
        },
      })

      const { html } = define({
        setup() {
          return () => h(VaporParent as any)
        },
      }).render()

      expect(html()).toContain('loading')

      await new Promise(resolve => setTimeout(resolve, duration + 1))
      await nextTick()

      expect(html()).toContain('<div><button>click</button></div>')
    })

    test('renders async VDOM child from vapor slot outlet inside VDOM Suspense', async () => {
      const duration = 5

      const VaporSlotOutlet = defineVaporComponent({
        setup() {
          return createSlot('default')
        },
      })

      const VDomAsyncChild = defineComponent({
        async setup() {
          await new Promise(resolve => setTimeout(resolve, duration))
          return () => h('div', 'slot async')
        },
      })

      const App = defineComponent({
        setup() {
          return () =>
            h(Suspense, null, {
              default: () =>
                h(VaporSlotOutlet as any, null, {
                  default: () => [h(VDomAsyncChild as any)],
                }),
              fallback: () => h('div', 'loading'),
            })
        },
      })

      const { html } = define(App).render()

      expect(html()).toContain('loading')

      await new Promise(resolve => setTimeout(resolve, duration + 1))
      await nextTick()

      expect(html()).toContain('<div>slot async</div>')
    })

    test('renders async VDOM vnode via createDynamicComponent inside VDOM Suspense', async () => {
      const duration = 5

      const VDomAsyncChild = defineComponent({
        async setup() {
          await new Promise(resolve => setTimeout(resolve, duration))
          return () => h('button', 'vnode async')
        },
      })

      const VaporParent = defineVaporComponent({
        setup() {
          return createComponent(
            Suspense as any,
            null,
            {
              default: () =>
                createDynamicComponent(
                  () => h(VDomAsyncChild as any),
                  null,
                  null,
                  VaporDynamicComponentFlags.SINGLE_ROOT,
                ),
              fallback: () => template('loading')(),
            },
            true,
          )
        },
      })

      const { html } = define({
        setup() {
          return () => h(VaporParent as any)
        },
      }).render()

      expect(html()).toContain('loading')

      await new Promise(resolve => setTimeout(resolve, duration + 1))
      await nextTick()

      expect(html()).toContain('<button>vnode async</button>')
    })

    test('mounts VDOM Suspense from createDynamicComponent', async () => {
      const VaporChild = defineVaporComponent({
        setup() {
          return createDynamicComponent(
            () => Suspense,
            null,
            {
              default: () => template('<span>resolved</span>')(),
              fallback: () => template('<span>fallback</span>')(),
            },
            VaporDynamicComponentFlags.SINGLE_ROOT,
          )
        },
      })

      const { html } = define({
        setup() {
          return () => h(VaporChild as any)
        },
      }).render()

      await nextTick()
      expect(html()).toContain('<span>resolved</span>')
    })

    test('mounted/activated hooks defer to the owning suspense boundary', async () => {
      const timeout = (n = 0) => new Promise(r => setTimeout(r, n))
      const order: string[] = []

      const VaporChild = defineVaporComponent({
        setup() {
          onMounted(() => order.push('vapor mounted'))
          return template('<div>vapor</div>', 1)()
        },
      })

      const AsyncSibling = defineComponent({
        async setup() {
          await timeout(5)
          return () => h('span', 'async')
        },
      })

      const { html } = define({
        setup() {
          return () =>
            h(
              Suspense,
              { onResolve: () => order.push('suspense resolved') },
              {
                default: () =>
                  h('div', [h(VaporChild as any), h(AsyncSibling)]),
                fallback: () => h('span', 'loading'),
              },
            )
        },
      }).render()

      await timeout(20)
      await nextTick()

      expect(html()).toContain('<div>vapor</div>')
      expect(order).toEqual(['suspense resolved', 'vapor mounted'])
    })
  })

  describe('current scope', () => {
    test('does not leak active scope after mounting sync-setup vapor child', () => {
      const VaporChild = defineVaporComponent({
        setup() {
          return template('<div>vapor</div>')()
        },
      })

      const host = document.createElement('div')
      const app = createApp({
        render: () => h(VaporChild as any),
      })
      app.use(vaporInteropPlugin)
      app.mount(host)

      expect(getCurrentScope()).toBeUndefined()
    })

    test('vapor component mounted via Suspense branch swap is not unmounted on resolve', async () => {
      const unmounted = vi.fn()

      const VaporChild = defineVaporComponent({
        setup() {
          return template('<span>sync vapor</span>')()
        },
      })

      const Page1 = defineComponent({
        setup() {
          return () => h('div', [h(VaporChild as any)])
        },
      })

      const VaporPage2 = defineVaporComponent({
        async setup() {
          onUnmounted(unmounted)
          return template('<div>page 2</div>')()
        },
      })

      const current = shallowRef<any>(Page1)
      const host = document.createElement('div')
      const app = createApp({
        render: () =>
          h(Suspense, null, {
            default: () => h(current.value),
          }),
      })
      app.use(vaporInteropPlugin)
      app.mount(host)
      await nextTick()
      expect(host.innerHTML).toContain('sync vapor')

      current.value = VaporPage2
      await nextTick()
      await new Promise(resolve => setTimeout(resolve))
      await nextTick()

      expect(host.innerHTML).toContain('page 2')
      expect(unmounted).not.toHaveBeenCalled()
    })
  })

  describe('VaporSlot vnode vs metadata', () => {
    test('mount and update do not throw when vs is missing (nuxt/ui #6395)', async () => {
      const tick = ref(0)
      const App = defineComponent({
        setup() {
          return () => {
            tick.value
            const vnode = createVNode(VaporSlot, {})
            delete (vnode as any).vs
            return vnode
          }
        },
      })

      const root = document.createElement('div')
      const app = createApp(App)
      app.use(vaporInteropPlugin)
      const errorHandler = vi.fn()
      app.config.errorHandler = errorHandler

      expect(() => app.mount(root)).not.toThrow()

      tick.value++
      await nextTick()
      expect(root.childNodes.length).toBeGreaterThan(0)
      expect(errorHandler).not.toHaveBeenCalled()
      app.unmount()
    })

    test('mount and update do not throw when vs slot is missing', async () => {
      const tick = ref(0)
      const App = defineComponent({
        setup() {
          return () => {
            tick.value
            const vnode = createVNode(VaporSlot, {})
            ;(vnode as any).vs = {}
            return vnode
          }
        },
      })

      const root = document.createElement('div')
      const app = createApp(App)
      app.use(vaporInteropPlugin)
      const errorHandler = vi.fn()
      app.config.errorHandler = errorHandler

      expect(() => app.mount(root)).not.toThrow()

      tick.value++
      await nextTick()
      expect(errorHandler).not.toHaveBeenCalled()
      app.unmount()
    })
  })

  describe('vnode hooks', () => {
    test('should invoke onVnodeBeforeMount/onVnodeBeforeUnmount on vapor child', async () => {
      const beforeMountSpy = vi.fn()
      const beforeUnmountSpy = vi.fn()

      const VaporChild = defineVaporComponent({
        setup() {
          return template('<div>vapor</div>')()
        },
      })

      const show = ref(true)
      const App = defineComponent({
        setup() {
          return () =>
            show.value
              ? h(VaporChild as any, {
                  onVnodeBeforeMount: beforeMountSpy,
                  onVnodeBeforeUnmount: beforeUnmountSpy,
                })
              : null
        },
      })

      const root = document.createElement('div')
      const app = createApp(App)
      app.use(vaporInteropPlugin)
      app.mount(root)
      await nextTick()

      expect(beforeMountSpy).toHaveBeenCalledTimes(1)

      // unmount
      show.value = false
      await nextTick()
      expect(beforeUnmountSpy).toHaveBeenCalledTimes(1)
    })

    test('should invoke update hooks in VDOM order on vapor child self-update', async () => {
      const calls: string[] = []
      let flip!: () => void

      const VaporChild = defineVaporComponent({
        setup() {
          const alt = ref(false)
          onBeforeUpdate(() => calls.push('component beforeUpdate'))
          onUpdated(() => calls.push('component updated'))
          flip = () => {
            alt.value = true
          }
          return createIf(
            () => alt.value,
            () => template('<p>alt</p>')(),
            () => template('<div>base</div>')(),
          )
        },
      })

      const App = defineComponent({
        setup() {
          return () =>
            h(VaporChild as any, {
              onVnodeBeforeUpdate: (vnode: any, prevVNode: any) => {
                expect((vnode.el as Element).tagName).toBe('DIV')
                expect((prevVNode.el as Element).tagName).toBe('DIV')
                calls.push('vnode beforeUpdate')
              },
              onVnodeUpdated: (vnode: any) => {
                expect((vnode.el as Element).tagName).toBe('P')
                calls.push('vnode updated')
              },
            })
        },
      })

      const root = document.createElement('div')
      const app = createApp(App)
      app.use(vaporInteropPlugin)
      app.mount(root)

      expect(root.querySelector('div')!.textContent).toBe('base')

      flip()
      await nextTick()

      expect(root.querySelector('p')!.textContent).toBe('alt')
      expect(calls).toEqual([
        'component beforeUpdate',
        'vnode beforeUpdate',
        'component updated',
        'vnode updated',
      ])
    })
  })

  describe('transition', () => {
    const timeout = (n = 0) => new Promise(r => setTimeout(r, n))

    const makeHooks = () => {
      let finishLeave: (() => void) | undefined
      return {
        onLeave: vi.fn((_el: Element, done: () => void) => {
          finishLeave = done
        }),
        onEnter: vi.fn((_el: Element, done: () => void) => done()),
        onBeforeEnter: vi.fn(),
        onAfterEnter: vi.fn(),
        finishLeave: () => {
          finishLeave!()
          finishLeave = undefined
        },
      }
    }

    test('out-in + suspense: leaving async vapor component resolves leave and mounts next branch', async () => {
      const hooks = makeHooks()
      const VaporChild = defineVaporComponent({
        async setup() {
          await timeout()
          return template('<div>vapor</div>', 1)()
        },
      })
      const VdomChild = { setup: () => () => h('div', 'vdom') }
      const current = shallowRef<any>(VaporChild)
      const { host, html } = define({
        setup() {
          return () =>
            h(
              Transition,
              {
                mode: 'out-in',
                css: false,
                onLeave: hooks.onLeave,
                onEnter: hooks.onEnter,
              },
              {
                default: () =>
                  h(Suspense, null, {
                    default: () =>
                      h(current.value, {
                        key: current.value === VaporChild ? 'a' : 'b',
                      }),
                  }),
              },
            )
        },
      }).render()
      document.body.appendChild(host)

      await timeout(10)
      expect(html()).toContain('vapor')

      current.value = VdomChild
      await timeout(10)
      expect(hooks.onLeave).toHaveBeenCalledTimes(1)
      expect(html()).toContain('vapor')

      hooks.finishLeave()
      await timeout(10)
      expect(html()).toContain('vdom')
      expect(html()).not.toContain('vapor')
    })

    test('out-in + suspense: entering vapor component fires enter hooks once', async () => {
      const hooks = makeHooks()
      const VaporChild = compile(
        `<template><!-- ignored root --><div>vapor</div></template>`,
        ref(null),
      )
      const VdomChild = { setup: () => () => h('div', 'vdom') }
      const current = shallowRef<any>(VdomChild)
      const { host, html } = define({
        setup() {
          return () =>
            h(
              Transition,
              {
                mode: 'out-in',
                css: false,
                onLeave: hooks.onLeave,
                onEnter: hooks.onEnter,
                onBeforeEnter: hooks.onBeforeEnter,
                onAfterEnter: hooks.onAfterEnter,
              },
              {
                default: () =>
                  h(Suspense, null, {
                    default: () =>
                      h(current.value, {
                        key: current.value === VaporChild ? 'a' : 'b',
                      }),
                  }),
              },
            )
        },
      }).render()
      document.body.appendChild(host)

      expect(html()).toContain('vdom')
      current.value = VaporChild
      await nextTick()
      expect(hooks.onLeave).toHaveBeenCalledTimes(1)
      hooks.finishLeave()
      await nextTick()
      await nextTick()
      expect(html()).toContain('vapor')
      expect(hooks.onBeforeEnter).toHaveBeenCalledTimes(1)
      expect(hooks.onAfterEnter).toHaveBeenCalledTimes(1)
    })

    test('out-in + suspense: entering async vapor component fires enter hooks once', async () => {
      const hooks = makeHooks()
      const VaporChild = defineVaporComponent({
        async setup() {
          await timeout()
          return template('<div>vapor</div>', 1)()
        },
      })
      const VdomChild = { setup: () => () => h('div', 'vdom') }
      const current = shallowRef<any>(VdomChild)
      const { host, html } = define({
        setup() {
          return () =>
            h(
              Transition,
              {
                mode: 'out-in',
                css: false,
                onLeave: hooks.onLeave,
                onEnter: hooks.onEnter,
                onBeforeEnter: hooks.onBeforeEnter,
                onAfterEnter: hooks.onAfterEnter,
              },
              {
                default: () =>
                  h(Suspense, null, {
                    default: () =>
                      h(current.value, {
                        key: current.value === VaporChild ? 'a' : 'b',
                      }),
                  }),
              },
            )
        },
      }).render()
      document.body.appendChild(host)

      expect(html()).toContain('vdom')
      current.value = VaporChild
      await timeout(10)
      expect(hooks.onLeave).toHaveBeenCalledTimes(1)
      hooks.finishLeave()
      await timeout(10)
      expect(html()).toContain('vapor')
      expect(hooks.onBeforeEnter).toHaveBeenCalledTimes(1)
      expect(hooks.onAfterEnter).toHaveBeenCalledTimes(1)
    })

    test('default mode: leaving vapor component is removed after leave finishes', async () => {
      const hooks = makeHooks()
      const VaporChild = defineVaporComponent({
        async setup() {
          await timeout()
          return template('<div>vapor</div>', 1)()
        },
      })
      const VdomChild = { setup: () => () => h('div', 'vdom') }
      const current = shallowRef<any>(VaporChild)
      const { host, html } = define({
        setup() {
          return () =>
            h(
              Transition,
              { css: false, onLeave: hooks.onLeave },
              {
                default: () =>
                  h(Suspense, null, {
                    default: () =>
                      h(current.value, {
                        key: current.value === VaporChild ? 'a' : 'b',
                      }),
                  }),
              },
            )
        },
      }).render()
      document.body.appendChild(host)

      await timeout(10)
      current.value = VdomChild
      await nextTick()
      expect(hooks.onLeave).toHaveBeenCalledTimes(1)
      expect(html()).toContain('vapor')
      hooks.finishLeave()
      await nextTick()
      expect(html()).not.toContain('vapor')
      expect(html()).toContain('vdom')
    })

    test('out-in + suspense: leaving vapor branch completes after hooks re-clone', async () => {
      const hooks = makeHooks()
      const VaporChild = defineVaporComponent({
        setup() {
          return template('<div>vapor</div>', 1)()
        },
      })
      const VdomChild = { setup: () => () => h('div', 'vdom') }
      const current = shallowRef<any>(VaporChild)
      const tick = ref(0)
      const { host, html } = define({
        setup() {
          return () => {
            // reading tick makes a bump re-render the tree, which re-clones the
            // transition hooks onto the branch vnode (mirrors an intervening
            // parent render during an async page's resolve window in Nuxt).
            void tick.value
            return h(
              Transition,
              {
                mode: 'out-in',
                css: false,
                onLeave: hooks.onLeave,
                onEnter: hooks.onEnter,
              },
              {
                default: () =>
                  h(Suspense, null, {
                    default: () =>
                      h(current.value, {
                        key: current.value === VaporChild ? 'a' : 'b',
                      }),
                  }),
              },
            )
          }
        },
      }).render()
      document.body.appendChild(host)

      await timeout(10)
      expect(html()).toContain('vapor')

      tick.value++
      await nextTick()

      current.value = VdomChild
      await timeout(10)
      expect(hooks.onLeave).toHaveBeenCalledTimes(1)
      expect(html()).toContain('vapor')

      hooks.finishLeave()
      await timeout(10)
      expect(html()).toContain('vdom')
      expect(html()).not.toContain('vapor')
    })

    test('uses latest transition hooks when a vapor root branch switches', async () => {
      const data = ref({ show: true })
      const useSecondHook = ref(false)
      const firstLeave = vi.fn((_el: Element, done: () => void) => done())
      const secondLeave = vi.fn((_el: Element, done: () => void) => done())
      const VaporChild = compile(
        `<template>
          <div v-if="data.show">first</div>
          <div v-else>second</div>
        </template>`,
        data,
      )
      const { html } = define({
        setup() {
          return () =>
            h(
              Transition,
              {
                css: false,
                onLeave: useSecondHook.value ? secondLeave : firstLeave,
              },
              { default: () => h(VaporChild as any) },
            )
        },
      }).render()

      expect(html()).toContain('first')

      useSecondHook.value = true
      await nextTick()

      data.value.show = false
      await nextTick()

      expect(firstLeave).not.toHaveBeenCalled()
      expect(secondLeave).toHaveBeenCalledTimes(1)
      expect(html()).toContain('second')
    })
  })

  describe('error handling', () => {
    test('vdom parent captures error thrown in vapor child setup', async () => {
      const err = new Error('foo')
      const fn = vi.fn()
      const show = ref(false)

      const VaporChild = defineVaporComponent({
        setup() {
          throw err
        },
      })

      const Parent = defineComponent({
        setup() {
          onErrorCaptured((err, instance, info) => {
            fn(err, info)
            return false
          })
          return () => (show.value ? h(VaporChild as any) : h('div', 'ok'))
        },
      })

      const root = document.createElement('div')
      const app = createApp(Parent)
      app.use(vaporInteropPlugin)
      app.mount(root)
      expect(root.innerHTML).toBe('<div>ok</div>')

      show.value = true
      await nextTick()
      expect(fn).toHaveBeenCalledWith(err, 'setup function')

      show.value = false
      await nextTick()
      expect(root.innerHTML).toBe('<div>ok</div>')

      expect(() => app.unmount()).not.toThrow()
      expect(`returned non-block value`).toHaveBeenWarned()
    })
  })
})
