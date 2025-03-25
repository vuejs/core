import {
  type LooseRawProps,
  type VaporComponent,
  createComponent as createComp,
} from '../../src/component'
import {
  type VaporDirective,
  VaporTeleport,
  createIf,
  createTemplateRefSetter,
  setInsertionState,
  template,
  withVaporDirectives,
} from '@vue/runtime-vapor'
import { makeRender } from '../_utils'
import {
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
  })

  describe('HMR', () => {
    test('rerender', async () => {
      const target = document.createElement('div')
      const root = document.createElement('div')
      const childId = 'test1-child'
      const parentId = 'test1-parent'

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

      expect(root.innerHTML).toBe('<!--teleport--><div>root</div>')
      expect(target.innerHTML).toBe('<div>teleported</div>')

      // rerender child
      rerender(childId, () => {
        return template('<div>teleported 2</div>')()
      })

      expect(root.innerHTML).toBe('<!--teleport--><div>root</div>')
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

      expect(root.innerHTML).toBe('<!--teleport--><div>root 2</div>')
      expect(target.innerHTML).toBe('<div>teleported 2</div>')
    })

    test('reload', async () => {
      const target = document.createElement('div')
      const root = document.createElement('div')
      const childId = 'test2-child'
      const parentId = 'test2-parent'

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

      expect(root.innerHTML).toBe('<!--teleport--><div>root</div>')
      expect(target.innerHTML).toBe('<div>teleported</div>')

      // reload child
      reload(childId, {
        __hmrId: childId,
        __vapor: true,
        render() {
          return template('<div>teleported 2</div>')()
        },
      })
      expect(root.innerHTML).toBe('<!--teleport--><div>root</div>')
      expect(target.innerHTML).toBe('<div>teleported 2</div>')

      // reload parent
      reload(parentId, {
        __hmrId: parentId,
        __vapor: true,
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
          const n1 = template('<div>root 2</div>')()
          return [n0, n1]
        },
      })

      expect(root.innerHTML).toBe('<!--teleport--><div>root 2</div>')
      expect(target.innerHTML).toBe('<div>teleported 2</div>')
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

    expect(root.innerHTML).toBe('<!--teleport--><div>root</div>')
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

    expect(root.innerHTML).toBe('<!--teleport--><div>root</div>')
    expect(targetA.innerHTML).toBe('<div>teleported</div>')
    expect(targetB.innerHTML).toBe('')

    target.value = targetB
    await nextTick()

    expect(root.innerHTML).toBe('<!--teleport--><div>root</div>')
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
    expect(root.innerHTML).toBe('<div><!--teleport--><!--teleport--></div>')
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
    expect(root.innerHTML).toBe('<div><!--teleport--><!--teleport--></div>')
    expect(target.innerHTML).toBe('three')

    // toggle back
    child1.value = [
      template('<div>one</div>')(),
      template('<div>two</div>')(),
    ] as any
    child2.value = [template('three')()] as any
    await nextTick()
    expect(root.innerHTML).toBe('<div><!--teleport--><!--teleport--></div>')
    // should append
    expect(target.innerHTML).toBe('<div>one</div><div>two</div>three')

    // toggle the other teleport
    child2.value = [] as any
    await nextTick()
    expect(root.innerHTML).toBe('<div><!--teleport--><!--teleport--></div>')
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
      '<div></div><div>teleported</div><!--teleport-->',
    )
    disabled.value = false
    await nextTick()
    expect(root.innerHTML).toBe(
      '<div><div>teleported</div></div><!--teleport-->',
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

    expect(root.innerHTML).toBe('<!--teleport--><div>root</div>')
    expect(target.innerHTML).toBe('<div>teleported</div>')

    disabled.value = true
    await nextTick()
    expect(root.innerHTML).toBe(
      '<!--teleport start--><div>teleported</div><!--teleport end--><!--teleport--><div>root</div>',
    )
    expect(target.innerHTML).toBe('')

    // toggle back
    disabled.value = false
    await nextTick()
    expect(root.innerHTML).toBe(
      '<!--teleport start--><!--teleport end--><!--teleport--><div>root</div>',
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
    expect(root.innerHTML).toBe('<!--teleport-->')
    expect(target.innerHTML).toBe('<div>foo</div><!--if-->')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(teardown).not.toHaveBeenCalled()

    toggle.value = false
    await nextTick()
    expect(root.innerHTML).toBe('<!--teleport-->')
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
    expect(root.innerHTML).toBe('<!--teleport--><!--if--><div>teleported</div>')

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
      '<!--teleport--><!--if--><!--if--><div>foo</div>',
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
