import { createApp, ref, h, defineComponent, nextTick } from '@vue/runtime-dom'

describe('DomRef', () => {
  test(`should trigger an update when Dom's Ref change`, async () => {
    const root = document.createElement('div')
    let element: any = null
    const Child = defineComponent({
      setup() {
        return { el: ref(null) }
      },
      render() {
        return h('div', [
          h('p', { ref: 'el' }),
          this.$slots.default && this.$slots.default({ el: this.el })
        ])
      }
    })

    createApp({
      render() {
        return h(Child, null, {
          default({ el }: { el: HTMLElement }) {
            element = el
            return null
          }
        })
      }
    }).mount(root)

    await nextTick()
    expect(element instanceof HTMLParagraphElement).toBe(true)
  })
})
