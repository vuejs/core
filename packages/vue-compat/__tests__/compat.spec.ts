;(global as any).__COMPAT__ = true

import Vue from '../src/index-compat'

describe('2.x compat build', async () => {
  test('should work', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)

    const instance = new Vue({
      data() {
        return { count: 0 }
      },
      methods: {
        change() {
          this.count++
        }
      },
      render(h: any) {
        return h('div', this.count)
      }
    }).$mount(root)

    expect(instance.count).toBe(0)
    expect(root.textContent).toBe('0')

    instance.change()
    expect(instance.count).toBe(1)
    await Vue.nextTick()
    expect(root.textContent).toBe('1')
  })
})
