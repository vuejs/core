import {
  applyVShow,
  createComponent,
  createIf,
  defineVaporComponent,
  on,
  template,
} from '../../src'
import { type VShowElement, nextTick, ref } from 'vue'
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
    const n1 = n0.firstChild!
    const n2 = n1.nextSibling
    applyVShow(n2 as VShowElement, () => visible.value)
    on(n1 as HTMLElement, 'click', handleClick)
    return n0
  })

describe('directive: v-show', () => {
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
    const visible = ref(true)

    const { component: Child } = define({
      setup() {
        return t0()
      },
    })

    const { host } = define({
      setup() {
        const n1 = createComponent(Child, null, null, true)
        applyVShow(n1, () => visible.value)
        return n1
      },
    }).render()

    expect(host.innerHTML).toBe('<div>child</div>')

    visible.value = !visible.value
    await nextTick()
    expect(host.innerHTML).toBe('<div style="display: none;">child</div>')
  })

  test('warn on non-single-element-root component', () => {
    const Child = defineVaporComponent({
      setup() {
        return document.createTextNode('b')
      },
    })
    define({
      setup() {
        const n1 = createComponent(Child)
        applyVShow(n1, () => true)
        return n1
      },
    }).render()
    expect(
      'v-show used on component with non-single-element root node',
    ).toHaveBeenWarned()
  })

  test('should work on component with dynamic fragment root', async () => {
    const t0 = template('<div>child</div>')
    const t1 = template('<span>child</span>')
    const childIf = ref(true)
    const visible = ref(true)

    const { component: Child } = define({
      setup() {
        return createIf(
          () => childIf.value,
          () => t0(),
          () => t1(),
        )
      },
    })

    const { host } = define({
      setup() {
        const n1 = createComponent(Child, null, null, true)
        applyVShow(n1, () => visible.value)
        return n1
      },
    }).render()

    expect(host.innerHTML).toBe('<div>child</div><!--if-->')

    visible.value = !visible.value
    await nextTick()
    expect(host.innerHTML).toBe(
      '<div style="display: none;">child</div><!--if-->',
    )

    childIf.value = !childIf.value
    await nextTick()
    expect(host.innerHTML).toBe(
      '<span style="display: none;">child</span><!--if-->',
    )

    visible.value = !visible.value
    await nextTick()
    expect(host.innerHTML).toBe('<span style="">child</span><!--if-->')
  })
})
