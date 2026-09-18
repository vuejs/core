import { defineComponent, h, nextTick, ref } from 'vue'
import { render } from '@vue/runtime-dom'

test('Fragment anchors survive Node.normalize() before updates', async () => {
  const root = document.createElement('div')
  const show = ref(true)
  render(
    h(
      defineComponent({
        setup() {
          return () =>
            h(
              'div',
              show.value
                ? [h('span', 'First'), h('span', 'Second')]
                : [h('span', 'Replacement')],
            )
        },
      }),
    ),
    root,
  )
  root.normalize()
  show.value = false
  await nextTick()
  expect(root.innerHTML).toBe('<div><span>Replacement</span></div>')
  expect(root.textContent).toBe('Replacement')
})
