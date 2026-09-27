import { nextTick, ref } from '@vue/runtime-dom'
import { renderParity } from './_utils'

// #15671: the compiler must not hoist a member expression that is only read
// conditionally out of its position - the hoisted read is evaluated on every
// render and throws where the original expression skipped it
describe('compiler: expression hoisting', () => {
  test('does not read a guarded member expression before its guard', async () => {
    const { vdom, vapor } = await renderParity(
      {
        App: `<script setup>
          import { ref } from 'vue'
          const x = ref({ y: 1 })
        </script>
        <template><p>{{ x === undefined ? '—' : x.y }}</p><p>{{ x === undefined ? '—' : x.y }}</p><button @click="x = undefined">clear</button></template>`,
      },
      () => ref(null),
      async (data, root) => {
        expect(root.textContent).toBe('11clear')

        root.querySelector('button')!.click()
        await nextTick()
        expect(root.textContent).toBe('——clear')
      },
    )
    expect(vapor.after).toBe(vdom.after)
    expect(vapor.text).toBe(vdom.text)
  })

  test('does not read a member expression from a callback that is never called', async () => {
    const { vdom, vapor } = await renderParity(
      {
        App: `<script setup>
          import { ref } from 'vue'
          const items = ref([])
          const x = ref()
        </script>
        <template><p>{{ items.map(() => x.y).join() }}</p><p>{{ items.map(() => x.y).join() + String(x) }}</p></template>`,
      },
      () => ref(null),
      async (data, root) => {
        expect(root.textContent).toBe('undefined')
      },
    )
    expect(vapor.after).toBe(vdom.after)
    expect(vapor.text).toBe(vdom.text)
  })
})
