import {
  type LooseRawProps,
  type VaporComponent,
  createComponent as createComp,
  createComponent,
} from '../../src/component'
import {
  type VaporDirective,
  VaporTeleport,
  child,
  createIf,
  createTemplateRefSetter,
  createVaporApp,
  defineVaporComponent,
  renderEffect,
  setInsertionState,
  setText,
  template,
  vaporInteropPlugin,
  withVaporDirectives,
} from '@vue/runtime-vapor'
import { makeRender } from '../_utils'
import {
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
} from 'vue'

import type { HMRRuntime } from '@vue/runtime-dom'
declare var __VUE_HMR_RUNTIME__: HMRRuntime
const { createRecord, rerender, reload } = __VUE_HMR_RUNTIME__

const define = makeRender()

describe('renderer: VaporTeleport', () => {
  describe('eager mode', () => {
    runSharedTests(false)
  })

  describe('defer mode', () => {
    runSharedTests(true)

    test('should be able to target content appearing later than the teleport with defer', () => {
      const root = document.createElement('div')
      document.body.appendChild(root)

      const { mount } = define({
        setup() {
          const n1 = createComp(
            VaporTeleport,
            {
              to: () => '#target',
              defer: () => true,
            },
            {
              default: () => template('<div>teleported</div>')(),
            },
          )
          const n2 = template('<div id=target></div>')()
          return [n1, n2]
        },
      }).create()
      mount(root)

      expect(root.innerHTML).toBe(
        '<!--teleport start--><!--teleport end--><div id="target"><div>teleported</div></div>',
      )
    })

    test.todo('defer mode should work inside suspense', () => {})

    test('update before mounted with defer', async () => {
      const root = document.createElement('div')
      document.body.appendChild(root)

      const show = ref(false)
      const foo = ref('foo')
      const Header = defineVaporComponent({
        props: { foo: String },
        setup(props) {
          const n0 = template(`<div> </div>`)()
          const x0 = child(n0 as any)
          renderEffect(() => setText(x0 as any, props.foo))
          return [n0]
        },
      })
      const Footer = defineVaporComponent({
        setup() {
          foo.value = 'bar'
          return template('<div>Footer</div>')()
        },
      })

      const { mount } = define({
        setup() {
          return createIf(
            () => show.value,
            () => {
              const n1 = createComp(
                VaporTeleport,
                { to: () => '#targetId', defer: () => true },
                { default: () => createComp(Header, { foo: () => foo.value }) },
              )
              const n2 = createComp(Footer)
              const n3 = template('<div id="targetId"></div>')()
              return [n1, n2, n3]
            },
            () => template('<div></div>')(),
          )
        },
      }).create()
      mount(root)

      expect(root.innerHTML).toBe('<div></div><!--if-->')

      show.value = true
      await nextTick()
      expect(root.innerHTML).toBe(
        `<!--teleport start--><!--teleport end--><div>Footer</div><div id="targetId"><div>bar</div></div><!--if-->`,
      )
    })
  })

  describe('HMR', () => {
    test('rerender child + rerender parent', async () => {
      const target = document.createElement('div')
      const root = document.createElement('div')
      const childId = 'test1-child-rerender'
      const parentId = 'test1-parent-rerender'

      const { component: Child } = define({
        __hmrId: childId,
        render() {
          return template('<div>teleported</div>')()
        },
      })
      createRecord(childId, Child as any)

      const { mount, component: Parent } = define({
        __hmrId: parentId,
        render() {
          const n0 = createComp(
            VaporTeleport,
            {
              to: () => target,
            },
            {
              default: () => createComp(Child),
            },
          )
          const n1 = template('<div>root</div>')()
          return [n0, n1]
        },
      }).create()
      createRecord(parentId, Parent as any)
      mount(root)

      expect(root.innerHTML).toBe(
        '<!--teleport start--><!--teleport end--><div>root</div>',
      )
      expect(target.innerHTML).toBe('<div>teleported</div>')

      // rerender child
      rerender(childId, () => {
        return template('<div>teleported 2</div>')()
      })

      expect(root.innerHTML).toBe(
        '<!--teleport start--><!--teleport end--><div>root</div>',
      )
      expect(target.innerHTML).toBe('<div>teleported 2</div>')

      // rerender parent
      rerender(parentId, () => {
        const n0 = createComp(
          VaporTeleport,
          {
            to: () => target,
          },
          {
            default: () => createComp(Child),
          },
        )
        const n1 = template('<div>root 2</div>')()
        return [n0, n1]
      })

      expect(root.innerHTML).toBe(
        '<!--teleport start--><!--teleport end--><div>root 2</div>',
      )
      expect(target.innerHTML).toBe('<div>teleported 2</div>')
    })

    test('parent rerender + toggle disabled', async () => {
      const target = document.createElement('div')
      const root = document.createElement('div')
      const parentId = 'test3-parent-rerender'
      const disabled = ref(true)

      const Child = defineVaporComponent({
        render() {
          return template('<div>teleported</div>')()
        },
      })

      const { mount, component: Parent } = define({
        __hmrId: parentId,
        render() {
          const n2 = template('<div><div>root</div></div>', true)() as any
          setInsertionState(n2, 0)
          createComp(
            VaporTeleport,
            {
              to: () => target,
              disabled: () => disabled.value,
            },
            {
              default: () => createComp(Child),
            },
          )
          return n2
        },
      }).create()
      createRecord(parentId, Parent as any)
      mount(root)

      expect(root.innerHTML).toBe(
        '<div><!--teleport start--><div>teleported</div><!--teleport end--><div>root</div></div>',
      )
      expect(target.innerHTML).toBe('')

      // rerender parent
      rerender(parentId, () => {
        const n2 = template('<div><div>root 2</div></div>', true)() as any
        setInsertionState(n2, 0)
        createComp(
          VaporTeleport,
          {
            to: () => target,
            disabled: () => disabled.value,
          },
          {
            default: () => createComp(Child),
          },
        )
        return n2
      })

      expect(root.innerHTML).toBe(
        '<div><!--teleport start--><div>teleported</div><!--teleport end--><div>root 2</div></div>',
      )
      expect(target.innerHTML).toBe('')

      // toggle disabled
      disabled.value = false
      await nextTick()
      expect(root.innerHTML).toBe(
        '<div><!--teleport start--><!--teleport end--><div>root 2</div></div>',
      )
      expect(target.innerHTML).toBe('<div>teleported</div>')
    })

    test('reload child + reload parent', async () => {
      const target = document.createElement('div')
      const root = document.createElement('div')
      const childId = 'test1-child-reload'
      const parentId = 'test1-parent-reload'

      const { component: Child } = define({
        __hmrId: childId,
        setup() {
          const msg = ref('teleported')
          return { msg }
        },
        render(ctx) {
          const n0 = template(`<div> </div>`)()
          const x0 = child(n0 as any)
          renderEffect(() => setText(x0 as any, ctx.msg))
          return [n0]
        },
      })
      createRecord(childId, Child as any)

      const { mount, component: Parent } = define({
        __hmrId: parentId,
        setup() {
          const msg = ref('root')
          const disabled = ref(false)
          return { msg, disabled }
        },
        render(ctx) {
          const n0 = createComp(
            VaporTeleport,
            {
              to: () => target,
              disabled: () => ctx.disabled,
            },
            {
              default: () => createComp(Child),
            },
          )
          const n1 = template(`<div> </div>`)()
          const x0 = child(n1 as any)
          renderEffect(() => setText(x0 as any, ctx.msg))
          return [n0, n1]
        },
      }).create()
      createRecord(parentId, Parent as any)
      mount(root)

      expect(root.innerHTML).toBe(
        '<!--teleport start--><!--teleport end--><div>root</div>',
      )
      expect(target.innerHTML).toBe('<div>teleported</div>')

      // reload child by changing msg
      reload(childId, {
        __hmrId: childId,
        __vapor: true,
        setup() {
          const msg = ref('teleported 2')
          return { msg }
        },
        render(ctx: any) {
          const n0 = template(`<div> </div>`)()
          const x0 = child(n0 as any)
          renderEffect(() => setText(x0 as any, ctx.msg))
          return [n0]
        },
      })
      expect(root.innerHTML).toBe(
        '<!--teleport start--><!--teleport end--><div>root</div>',
      )
      expect(target.innerHTML).toBe('<div>teleported 2</div>')

      // reload parent by changing msg
      reload(parentId, {
        __hmrId: parentId,
        __vapor: true,
        setup() {
          const msg = ref('root 2')
          const disabled = ref(false)
          return { msg, disabled }
        },
        render(ctx: any) {
          const n0 = createComp(
            VaporTeleport,
            {
              to: () => target,
              disabled: () => ctx.disabled,
            },
            {
              default: () => createComp(Child),
            },
          )
          const n1 = template(`<div> </div>`)()
          const x0 = child(n1 as any)
          renderEffect(() => setText(x0 as any, ctx.msg))
          return [n0, n1]
        },
      })

      expect(root.innerHTML).toBe(
        '<!--teleport start--><!--teleport end--><div>root 2</div>',
      )
      expect(target.innerHTML).toBe('<div>teleported 2</div>')

      // reload parent again by changing disabled
      reload(parentId, {
        __hmrId: parentId,
        __vapor: true,
        setup() {
          const msg = ref('root 2')
          const disabled = ref(true)
          return { msg, disabled }
        },
        render(ctx: any) {
          const n0 = createComp(
            VaporTeleport,
            {
              to: () => target,
              disabled: () => ctx.disabled,
            },
            {
              default: () => createComp(Child),
            },
          )
          const n1 = template(`<div> </div>`)()
          const x0 = child(n1 as any)
          renderEffect(() => setText(x0 as any, ctx.msg))
          return [n0, n1]
        },
      })

      expect(root.innerHTML).toBe(
        '<!--teleport start--><div>teleported 2</div><!--teleport end--><div>root 2</div>',
      )
      expect(target.innerHTML).toBe('')
    })

    test('reload single root child + toggle disabled', async () => {
      const target = document.createElement('div')
      const root = document.createElement('div')
      const childId = 'test2-child-reload'
      const parentId = 'test2-parent-reload'

      const disabled = ref(true)
      const { component: Child } = define({
        __hmrId: childId,
        setup() {
          const msg = ref('teleported')
          return { msg }
        },
        render(ctx) {
          const n0 = template(`<div> </div>`)()
          const x0 = child(n0 as any)
          renderEffect(() => setText(x0 as any, ctx.msg))
          return [n0]
        },
      })
      createRecord(childId, Child as any)

      const { mount, component: Parent } = define({
        __hmrId: parentId,
        setup() {
          const msg = ref('root')
          return { msg, disabled }
        },
        render(ctx) {
          const n0 = createComp(
            VaporTeleport,
            {
              to: () => target,
              disabled: () => ctx.disabled,
            },
            {
              // with single root child
              default: () => createComp(Child),
            },
          )
          const n1 = template(`<div> </div>`)()
          const x0 = child(n1 as any)
          renderEffect(() => setText(x0 as any, ctx.msg))
          return [n0, n1]
        },
      }).create()
      createRecord(parentId, Parent as any)
      mount(root)

      expect(root.innerHTML).toBe(
        '<!--teleport start--><div>teleported</div><!--teleport end--><div>root</div>',
      )
      expect(target.innerHTML).toBe('')

      // reload child by changing msg
      reload(childId, {
        __hmrId: childId,
        __vapor: true,
        setup() {
          const msg = ref('teleported 2')
          return { msg }
        },
        render(ctx: any) {
          const n0 = template(`<div> </div>`)()
          const x0 = child(n0 as any)
          renderEffect(() => setText(x0 as any, ctx.msg))
          return [n0]
        },
      })
      expect(root.innerHTML).toBe(
        '<!--teleport start--><div>teleported 2</div><!--teleport end--><div>root</div>',
      )
      expect(target.innerHTML).toBe('')

      // reload child again by changing msg
      reload(childId, {
        __hmrId: childId,
        __vapor: true,
        setup() {
          const msg = ref('teleported 3')
          return { msg }
        },
        render(ctx: any) {
          const n0 = template(`<div> </div>`)()
          const x0 = child(n0 as any)
          renderEffect(() => setText(x0 as any, ctx.msg))
          return [n0]
        },
      })
      expect(root.innerHTML).toBe(
        '<!--teleport start--><div>teleported 3</div><!--teleport end--><div>root</div>',
      )
      expect(target.innerHTML).toBe('')

      // toggle disabled
      disabled.value = false
      await nextTick()
      expect(root.innerHTML).toBe(
        '<!--teleport start--><!--teleport end--><div>root</div>',
      )
      expect(target.innerHTML).toBe('<div>teleported 3</div>')
    })

    test('reload multiple root children + toggle disabled', async () => {
      const target = document.createElement('div')
      const root = document.createElement('div')
      const childId = 'test3-child-reload'
      const parentId = 'test3-parent-reload'

      const disabled = ref(true)
      const { component: Child } = define({
        __hmrId: childId,
        setup() {
          const msg = ref('teleported')
          return { msg }
        },
        render(ctx) {
          const n0 = template(`<div> </div>`)()
          const x0 = child(n0 as any)
          renderEffect(() => setText(x0 as any, ctx.msg))
          return [n0]
        },
      })
      createRecord(childId, Child as any)

      const { mount, component: Parent } = define({
        __hmrId: parentId,
        setup() {
          const msg = ref('root')
          return { msg, disabled }
        },
        render(ctx) {
          const n0 = createComp(
            VaporTeleport,
            {
              to: () => target,
              disabled: () => ctx.disabled,
            },
            {
              default: () => {
                // with multiple root children
                return [createComp(Child), template(`<span>child</span>`)()]
              },
            },
          )
          const n1 = template(`<div> </div>`)()
          const x0 = child(n1 as any)
          renderEffect(() => setText(x0 as any, ctx.msg))
          return [n0, n1]
        },
      }).create()
      createRecord(parentId, Parent as any)
      mount(root)

      expect(root.innerHTML).toBe(
        '<!--teleport start--><div>teleported</div><span>child</span><!--teleport end--><div>root</div>',
      )
      expect(target.innerHTML).toBe('')

      // reload child by changing msg
      reload(childId, {
        __hmrId: childId,
        __vapor: true,
        setup() {
          const msg = ref('teleported 2')
          return { msg }
        },
        render(ctx: any) {
          const n0 = template(`<div> </div>`)()
          const x0 = child(n0 as any)
          renderEffect(() => setText(x0 as any, ctx.msg))
          return [n0]
        },
      })
      expect(root.innerHTML).toBe(
        '<!--teleport start--><div>teleported 2</div><span>child</span><!--teleport end--><div>root</div>',
      )
      expect(target.innerHTML).toBe('')

      // reload child again by changing msg
      reload(childId, {
        __hmrId: childId,
        __vapor: true,
        setup() {
          const msg = ref('teleported 3')
          return { msg }
        },
        render(ctx: any) {
          const n0 = template(`<div> </div>`)()
          const x0 = child(n0 as any)
          renderEffect(() => setText(x0 as any, ctx.msg))
          return [n0]
        },
      })
      expect(root.innerHTML).toBe(
        '<!--teleport start--><div>teleported 3</div><span>child</span><!--teleport end--><div>root</div>',
      )
      expect(target.innerHTML).toBe('')

      // toggle disabled
      disabled.value = false
      await nextTick()
      expect(root.innerHTML).toBe(
        '<!--teleport start--><!--teleport end--><div>root</div>',
      )
      expect(target.innerHTML).toBe('<div>teleported 3</div><span>child</span>')
    })
  })

  describe('VDOM interop', () => {
    test('render vdom component', async () => {
      const target = document.createElement('div')
      const root = document.createElement('div')

      const VDOMComp = {
        setup() {
          return () => h('h1', null, 'vdom comp')
        },
      }

      const disabled = ref(true)
      const App = defineVaporComponent({
        setup() {
          const n1 = createComponent(
            VaporTeleport,
            {
              to: () => target,
              defer: () => '',
              disabled: () => disabled.value,
            },
            {
              default: () => {
                const n0 = createComponent(VDOMComp)
                return n0
              },
            },
            true,
          )
          return n1
        },
      })

      const app = createVaporApp(App)
      app.use(vaporInteropPlugin)
      app.mount(root)

      expect(target.innerHTML).toBe('')
      expect(root.innerHTML).toBe(
        '<!--teleport start--><h1>vdom comp</h1><!--teleport end-->',
      )

      disabled.value = false
      await nextTick()
      expect(root.innerHTML).toBe('<!--teleport start--><!--teleport end-->')
      expect(target.innerHTML).toBe('<h1>vdom comp</h1>')
    })
  })
})

function runSharedTests(deferMode: boolean): void {
  const createComponent = deferMode
    ? (
        component: VaporComponent,
        rawProps?: LooseRawProps | null,
        ...args: any[]
      ) => {
        if (component === VaporTeleport) {
          rawProps!.defer = () => true
        }
        return createComp(component, rawProps, ...args)
      }
    : createComp

  test('should work', () => {
    const target = document.createElement('div')
    const root = document.createElement('div')

    const { mount } = define({
      setup() {
        const n0 = createComponent(
          VaporTeleport,
          {
            to: () => target,
          },
          {
            default: () => template('<div>teleported</div>')(),
          },
        )
        const n1 = template('<div>root</div>')()
        return [n0, n1]
      },
    }).create()
    mount(root)

    expect(root.innerHTML).toBe(
      '<!--teleport start--><!--teleport end--><div>root</div>',
    )
    expect(target.innerHTML).toBe('<div>teleported</div>')
  })

  test.todo('should work with SVG', async () => {})

  test('should update target', async () => {
    const targetA = document.createElement('div')
    const targetB = document.createElement('div')
    const target = ref(targetA)
    const root = document.createElement('div')

    const { mount } = define({
      setup() {
        const n0 = createComponent(
          VaporTeleport,
          {
            to: () => target.value,
          },
          {
            default: () => template('<div>teleported</div>')(),
          },
        )
        const n1 = template('<div>root</div>')()
        return [n0, n1]
      },
    }).create()
    mount(root)

    expect(root.innerHTML).toBe(
      '<!--teleport start--><!--teleport end--><div>root</div>',
    )
    expect(targetA.innerHTML).toBe('<div>teleported</div>')
    expect(targetB.innerHTML).toBe('')

    target.value = targetB
    await nextTick()

    expect(root.innerHTML).toBe(
      '<!--teleport start--><!--teleport end--><div>root</div>',
    )
    expect(targetA.innerHTML).toBe('')
    expect(targetB.innerHTML).toBe('<div>teleported</div>')
  })

  test('should update children', async () => {
    const target = document.createElement('div')
    const root = document.createElement('div')
    const children = shallowRef([template('<div>teleported</div>')()])

    const { mount } = define({
      setup() {
        const n0 = createComponent(
          VaporTeleport,
          {
            to: () => target,
          },
          {
            default: () => children.value,
          },
        )
        const n1 = template('<div>root</div>')()
        return [n0, n1]
      },
    }).create()
    mount(root)

    expect(target.innerHTML).toBe('<div>teleported</div>')

    children.value = [template('')()]
    await nextTick()
    expect(target.innerHTML).toBe('')

    children.value = [template('teleported')()]
    await nextTick()
    expect(target.innerHTML).toBe('teleported')
  })

  test('should remove children when unmounted', async () => {
    const target = document.createElement('div')
    const root = document.createElement('div')

    function testUnmount(props: any) {
      const { app } = define({
        setup() {
          const n0 = createComponent(VaporTeleport, props, {
            default: () => template('<div>teleported</div>')(),
          })
          const n1 = template('<div>root</div>')()
          return [n0, n1]
        },
      }).create()
      app.mount(root)

      expect(target.innerHTML).toBe(
        props.disabled() ? '' : '<div>teleported</div>',
      )

      app.unmount()
      expect(target.innerHTML).toBe('')
      expect(target.children.length).toBe(0)
    }

    testUnmount({ to: () => target, disabled: () => false })
    testUnmount({ to: () => target, disabled: () => true })
    testUnmount({ to: () => null, disabled: () => true })
  })

  test('component with multi roots should be removed when unmounted', async () => {
    const target = document.createElement('div')
    const root = document.createElement('div')

    const { component: Comp } = define({
      setup() {
        return [template('<p>')(), template('<p>')()]
      },
    })

    const { app } = define({
      setup() {
        const n0 = createComponent(
          VaporTeleport,
          {
            to: () => target,
          },
          {
            default: () => createComponent(Comp),
          },
        )
        const n1 = template('<div>root</div>')()
        return [n0, n1]
      },
    }).create()

    app.mount(root)
    expect(target.innerHTML).toBe('<p></p><p></p>')

    app.unmount()
    expect(target.innerHTML).toBe('')
  })

  test('descendent component should be unmounted when teleport is disabled and unmounted', async () => {
    const root = document.createElement('div')
    const beforeUnmount = vi.fn()
    const unmounted = vi.fn()
    const { component: Comp } = define({
      setup() {
        onBeforeUnmount(beforeUnmount)
        onUnmounted(unmounted)
        return [template('<p>')(), template('<p>')()]
      },
    })

    const { app } = define({
      setup() {
        const n0 = createComponent(
          VaporTeleport,
          {
            to: () => null,
            disabled: () => true,
          },
          {
            default: () => createComponent(Comp),
          },
        )
        return [n0]
      },
    }).create()
    app.mount(root)

    expect(beforeUnmount).toHaveBeenCalledTimes(0)
    expect(unmounted).toHaveBeenCalledTimes(0)

    app.unmount()
    await nextTick()
    expect(beforeUnmount).toHaveBeenCalledTimes(1)
    expect(unmounted).toHaveBeenCalledTimes(1)
  })

  test('multiple teleport with same target', async () => {
    const target = document.createElement('div')
    const root = document.createElement('div')

    const child1 = shallowRef(template('<div>one</div>')())
    const child2 = shallowRef(template('two')())

    const { mount } = define({
      setup() {
        const n0 = template('<div></div>')()
        setInsertionState(n0 as any)
        createComponent(
          VaporTeleport,
          {
            to: () => target,
          },
          {
            default: () => child1.value,
          },
        )
        setInsertionState(n0 as any)
        createComponent(
          VaporTeleport,
          {
            to: () => target,
          },
          {
            default: () => child2.value,
          },
        )
        return [n0]
      },
    }).create()
    mount(root)
    expect(root.innerHTML).toBe(
      '<div><!--teleport start--><!--teleport end--><!--teleport start--><!--teleport end--></div>',
    )
    expect(target.innerHTML).toBe('<div>one</div>two')

    // update existing content
    child1.value = [
      template('<div>one</div>')(),
      template('<div>two</div>')(),
    ] as any
    child2.value = [template('three')()] as any
    await nextTick()
    expect(target.innerHTML).toBe('<div>one</div><div>two</div>three')

    // toggling
    child1.value = [] as any
    await nextTick()
    expect(root.innerHTML).toBe(
      '<div><!--teleport start--><!--teleport end--><!--teleport start--><!--teleport end--></div>',
    )
    expect(target.innerHTML).toBe('three')

    // toggle back
    child1.value = [
      template('<div>one</div>')(),
      template('<div>two</div>')(),
    ] as any
    child2.value = [template('three')()] as any
    await nextTick()
    expect(root.innerHTML).toBe(
      '<div><!--teleport start--><!--teleport end--><!--teleport start--><!--teleport end--></div>',
    )
    // should append
    expect(target.innerHTML).toBe('<div>one</div><div>two</div>three')

    // toggle the other teleport
    child2.value = [] as any
    await nextTick()
    expect(root.innerHTML).toBe(
      '<div><!--teleport start--><!--teleport end--><!--teleport start--><!--teleport end--></div>',
    )
    expect(target.innerHTML).toBe('<div>one</div><div>two</div>')
  })

  test('should work when using template ref as target', async () => {
    const root = document.createElement('div')
    const target = ref<HTMLElement | null>(null)
    const disabled = ref(true)

    const { mount } = define({
      setup() {
        const setTemplateRef = createTemplateRefSetter()
        const n0 = template('<div></div>')() as any
        setTemplateRef(n0, target)

        const n1 = createComponent(
          VaporTeleport,
          {
            to: () => target.value,
            disabled: () => disabled.value,
          },
          {
            default: () => template('<div>teleported</div>')(),
          },
        )
        return [n0, n1]
      },
    }).create()
    mount(root)

    expect(root.innerHTML).toBe(
      '<div></div><!--teleport start--><div>teleported</div><!--teleport end-->',
    )
    disabled.value = false
    await nextTick()
    expect(root.innerHTML).toBe(
      '<div><div>teleported</div></div><!--teleport start--><!--teleport end-->',
    )
  })

  test('disabled', async () => {
    const target = document.createElement('div')
    const root = document.createElement('div')

    const disabled = ref(false)
    const { mount } = define({
      setup() {
        const n0 = createComponent(
          VaporTeleport,
          {
            to: () => target,
            disabled: () => disabled.value,
          },
          {
            default: () => template('<div>teleported</div>')(),
          },
        )
        const n1 = template('<div>root</div>')()
        return [n0, n1]
      },
    }).create()
    mount(root)

    expect(root.innerHTML).toBe(
      '<!--teleport start--><!--teleport end--><div>root</div>',
    )
    expect(target.innerHTML).toBe('<div>teleported</div>')

    disabled.value = true
    await nextTick()
    expect(root.innerHTML).toBe(
      '<!--teleport start--><div>teleported</div><!--teleport end--><div>root</div>',
    )
    expect(target.innerHTML).toBe('')

    // toggle back
    disabled.value = false
    await nextTick()
    expect(root.innerHTML).toBe(
      '<!--teleport start--><!--teleport end--><div>root</div>',
    )
    expect(target.innerHTML).toBe('<div>teleported</div>')
  })

  test(`the dir hooks of the Teleport's children should be called correctly`, async () => {
    const target = document.createElement('div')
    const root = document.createElement('div')
    const toggle = ref(true)

    const spy = vi.fn()
    const teardown = vi.fn()
    const dir: VaporDirective = vi.fn((el, source) => {
      spy()
      return teardown
    })

    const { mount } = define({
      setup() {
        return createComponent(
          VaporTeleport,
          {
            to: () => target,
          },
          {
            default: () => {
              return createIf(
                () => toggle.value,
                () => {
                  const n1 = template('<div>foo</div>')() as any
                  withVaporDirectives(n1, [[dir]])
                  return n1
                },
              )
            },
          },
        )
      },
    }).create()

    mount(root)
    expect(root.innerHTML).toBe('<!--teleport start--><!--teleport end-->')
    expect(target.innerHTML).toBe('<div>foo</div><!--if-->')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(teardown).not.toHaveBeenCalled()

    toggle.value = false
    await nextTick()
    expect(root.innerHTML).toBe('<!--teleport start--><!--teleport end-->')
    expect(target.innerHTML).toBe('<!--if-->')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(teardown).toHaveBeenCalledTimes(1)
  })

  test(`ensure that target changes when disabled are updated correctly when enabled`, async () => {
    const root = document.createElement('div')
    const target1 = document.createElement('div')
    const target2 = document.createElement('div')
    const target3 = document.createElement('div')
    const target = ref(target1)
    const disabled = ref(true)

    const { mount } = define({
      setup() {
        return createComponent(
          VaporTeleport,
          {
            to: () => target.value,
            disabled: () => disabled.value,
          },
          {
            default: () => template('<div>teleported</div>')(),
          },
        )
      },
    }).create()
    mount(root)

    disabled.value = false
    await nextTick()
    expect(target1.innerHTML).toBe('<div>teleported</div>')
    expect(target2.innerHTML).toBe('')
    expect(target3.innerHTML).toBe('')

    disabled.value = true
    await nextTick()
    target.value = target2
    await nextTick()
    expect(target1.innerHTML).toBe('')
    expect(target2.innerHTML).toBe('')
    expect(target3.innerHTML).toBe('')

    target.value = target3
    await nextTick()
    expect(target1.innerHTML).toBe('')
    expect(target2.innerHTML).toBe('')
    expect(target3.innerHTML).toBe('')

    disabled.value = false
    await nextTick()
    expect(target1.innerHTML).toBe('')
    expect(target2.innerHTML).toBe('')
    expect(target3.innerHTML).toBe('<div>teleported</div>')
  })

  test('toggle sibling node inside target node', async () => {
    const root = document.createElement('div')
    const show = ref(false)
    const { mount } = define({
      setup() {
        return createIf(
          () => show.value,
          () => {
            return createComponent(
              VaporTeleport,
              {
                to: () => root,
              },
              {
                default: () => template('<div>teleported</div>')(),
              },
            )
          },
          () => {
            return template('<div>foo</div>')()
          },
        )
      },
    }).create()

    mount(root)
    expect(root.innerHTML).toBe('<div>foo</div><!--if-->')

    show.value = true
    await nextTick()
    expect(root.innerHTML).toBe(
      '<!--teleport start--><!--teleport end--><!--if--><div>teleported</div>',
    )

    show.value = false
    await nextTick()
    expect(root.innerHTML).toBe('<div>foo</div><!--if-->')
  })

  test('unmount previous sibling node inside target node', async () => {
    const root = document.createElement('div')
    const parentShow = ref(false)
    const childShow = ref(true)

    const { component: Comp } = define({
      setup() {
        return createComponent(
          VaporTeleport,
          { to: () => root },
          {
            default: () => {
              return template('<div>foo</div>')()
            },
          },
        )
      },
    })

    const { mount } = define({
      setup() {
        return createIf(
          () => parentShow.value,
          () =>
            createIf(
              () => childShow.value,
              () => createComponent(Comp),
              () => template('bar')(),
            ),
          () => template('foo')(),
        )
      },
    }).create()

    mount(root)
    expect(root.innerHTML).toBe('foo<!--if-->')

    parentShow.value = true
    await nextTick()
    expect(root.innerHTML).toBe(
      '<!--teleport start--><!--teleport end--><!--if--><!--if--><div>foo</div>',
    )

    parentShow.value = false
    await nextTick()
    expect(root.innerHTML).toBe('foo<!--if-->')
  })

  test('accessing template refs inside teleport', async () => {
    const target = document.createElement('div')
    const tRef = ref()
    let tRefInMounted

    const { mount } = define({
      setup() {
        onMounted(() => {
          tRefInMounted = tRef.value
        })
        const n1 = createComponent(
          VaporTeleport,
          {
            to: () => target,
          },
          {
            default: () => {
              const setTemplateRef = createTemplateRefSetter()
              const n0 = template('<div>teleported</div>')() as any
              setTemplateRef(n0, tRef)
              return n0
            },
          },
        )
        return n1
      },
    }).create()
    mount(target)

    const child = target.children[0]
    expect(child.outerHTML).toBe(`<div>teleported</div>`)
    expect(tRefInMounted).toBe(child)
  })
}
