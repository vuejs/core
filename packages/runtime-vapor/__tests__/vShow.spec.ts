import { children, on, template, vShow, withDirectives } from '../src'
import { nextTick, ref } from 'vue'
import { describe, expect, test } from 'vitest'
import { makeRender } from './_utils'

const define = makeRender()

const createDemo = (defaultValue: boolean) =>
  define(() => {
    const visible = ref(defaultValue)
    function handleClick() {
      visible.value = !visible.value
    }
    const t0 = template('<button>toggle</button><h1>hello world</h1>')
    const n0 = t0()
    const {
      0: [n1],
      1: [n2],
    } = children(n0)
    withDirectives(n2, [[vShow, () => visible.value]])
    on(n1 as HTMLElement, 'click', () => handleClick)
    return n0
  })
describe('directive: v-show', () => {
  test('basic', async () => {
    const { host } = createDemo(true).render()
    const btn = host.querySelector('button')
    expect(host.innerHTML).toBe('<button>toggle</button><h1>hello world</h1>')
    btn?.click()
    await nextTick()
    expect(host.innerHTML).toBe(
      '<button>toggle</button><h1 style="display: none;">hello world</h1>',
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
})
