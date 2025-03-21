import {
  type LooseRawProps,
  type VaporComponent,
  createComponent as originalCreateComponent,
} from '../../src/component'
import { VaporTeleport, template } from '@vue/runtime-vapor'

import { makeRender } from '../_utils'
import { nextTick, onBeforeUnmount, onUnmounted, ref, shallowRef } from 'vue'

const define = makeRender()

describe('renderer: VaporTeleport', () => {
  describe('eager mode', () => {
    runSharedTests(false)
  })

  describe('defer mode', () => {
    runSharedTests(true)
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
        return originalCreateComponent(component, rawProps, ...args)
      }
    : originalCreateComponent

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

  test.todo(
    'descendent component should be unmounted when teleport is disabled and unmounted',
    async () => {
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
      expect(beforeUnmount).toHaveBeenCalledTimes(1)
      expect(unmounted).toHaveBeenCalledTimes(1)
    },
  )

  test.todo('multiple teleport with same target', async () => {})
  test.todo('should work when using template ref as target', async () => {})
  test.todo('disabled', async () => {})
  test.todo('moving teleport while enabled', async () => {})
  test.todo('moving teleport while disabled', async () => {})
  test.todo('should work with block tree', async () => {})
  test.todo(
    `the dir hooks of the Teleport's children should be called correctly`,
    async () => {},
  )
  test.todo(
    `ensure that target changes when disabled are updated correctly when enabled`,
    async () => {},
  )
  test.todo('toggle sibling node inside target node', async () => {})
  test.todo('unmount previous sibling node inside target node', async () => {})
  test.todo('accessing template refs inside teleport', async () => {})
}
