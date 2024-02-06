import { children, on, render, template, vShow, withDirectives } from '../src'
import { defineComponent, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

let host: HTMLElement

const initHost = () => {
  host = document.createElement('div')
  host.setAttribute('id', 'host')
  document.body.appendChild(host)
}
beforeEach(() => {
  initHost()
})
afterEach(() => {
  host.remove()
})
const createDemo = (defaultValue: boolean) =>
  defineComponent({
    setup() {
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
    },
  })
describe('directive: v-show', () => {
  test('basic', async () => {
    const demo = createDemo(true)
    render(demo as any, {}, '#host')
    const btn = host.querySelector('button')
    expect(host.innerHTML).toBe('<button>toggle</button><h1>hello world</h1>')
    btn?.click()
    await nextTick()
    expect(host.innerHTML).toBe(
      '<button>toggle</button><h1 style="display: none;">hello world</h1>',
    )
  })
  test('should hide content when default value is false', async () => {
    const demo = createDemo(false)
    render(demo as any, {}, '#host')
    const btn = host.querySelector('button')
    const h1 = host.querySelector('h1')
    expect(h1?.style.display).toBe('none')
    btn?.click()
    await nextTick()
    expect(h1?.style.display).toBe('')
  })
})
