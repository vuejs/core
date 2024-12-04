import {
  children,
  createComponent,
  on,
  template,
  vShow,
  withDirectives,
} from '../../src'
import { nextTick, ref } from 'vue'
import { describe, expect, test } from 'vitest'
import { makeRender } from '../_utils'

const define = makeRender()

const createDemo = (defaultValue: boolean) =>
  define(() => {
    const visible = ref(defaultValue)
    function handleClick() {
      visible.value = !visible.value
    }
    const t0 = template(
      '<div><button>toggle</button><h1>hello world</h1></div>',
    )
    const n0 = t0()
    const n1 = children(n0, 0)
    const n2 = children(n0, 1)
    withDirectives(n2, [[vShow, () => visible.value]])
    on(n1 as HTMLElement, 'click', () => handleClick)
    return n0
  })
describe.todo('directive: v-show', () => {
  test('basic', async () => {
    const { host } = createDemo(true).render()
    const btn = host.querySelector('button')
    expect(host.innerHTML).toBe(
      '<div><button>toggle</button><h1>hello world</h1></div>',
    )
    btn?.click()
    await nextTick()
    expect(host.innerHTML).toBe(
      '<div><button>toggle</button><h1 style="display: none;">hello world</h1></div>',
    )
  })
  test('should hide content when default value is false', async () => {
    const { host } = createDemo(false).render()
    const btn = host.querySelector('button')
    const h1 = host.querySelector('h1')
    expect(h1?.style.display).toBe('none')
    btn?.click()
    await nextTick()
    expect(h1?.style.display).toBe('')
  })

  test('should work on component', async () => {
    const t0 = template('<div>child</div>')
    const t1 = template('<button>toggle</button>')
    const n0 = t0()
    const visible = ref(true)

    function handleClick() {
      visible.value = !visible.value
    }
    const { component: Child } = define({
      render() {
        return n0
      },
    })

    const { instance, host } = define({
      render() {
        const n1 = t1()
        const n2 = createComponent(Child, [], null, true)
        withDirectives(n2, [[vShow, () => visible.value]])
        on(n1 as HTMLElement, 'click', () => handleClick)
        return [n1, n2]
      },
    }).render()

    expect(host.innerHTML).toBe('<button>toggle</button><div>child</div>')
    expect(instance?.scope.dirs!.get(n0)![0].dir).toBe(vShow)

    const btn = host.querySelector('button')
    btn?.click()
    await nextTick()
    expect(host.innerHTML).toBe(
      '<button>toggle</button><div style="display: none;">child</div>',
    )
  })
})
