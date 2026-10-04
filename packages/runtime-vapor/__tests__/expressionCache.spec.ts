import { nextTick, ref } from '@vue/runtime-dom'
import { renderParity } from './_utils'

describe('expression cache', () => {
  // #15671
  test('a member expression read behind a guard is not read ahead of it', async () => {
    const { vdom, vapor } = await renderParity(
      {
        App: `<script setup>
          import { ref } from 'vue'
          const x = ref({ y: 'a' })
        </script>
        <template>
          <button @click="x = undefined">clear</button>
          <p>{{ x === undefined ? '-' : x.y }}</p>
          <p>{{ x === undefined ? '-' : x.y }}</p>
        </template>`,
      },
      () => ref(null),
      async (data, root) => {
        expect(root.textContent).toBe('clearaa')
        root.querySelector('button')!.click()
        await nextTick()
        expect(root.textContent).toBe('clear--')
      },
    )
    expect(vapor.after).toBe(vdom.after)
  })

  test('a member expression nested in another one', async () => {
    const { vdom, vapor } = await renderParity(
      {
        App: `<script setup>
          import { ref } from 'vue'
          const levels = { a: { color: 'red', label: 'A' }, b: { color: 'blue', label: 'B' } }
          const rungs = [{ level: 'a' }, { level: 'b' }]
          const i = ref(0)
        </script>
        <template>
          <button @click="i++">next</button>
          <p :title="levels[rungs[i].level].color">{{ levels[rungs[i].level].label }}</p>
        </template>`,
      },
      () => ref(null),
      async (data, root) => {
        expect(root.querySelector('p')!.title).toBe('red')
        expect(root.textContent).toBe('nextA')
        root.querySelector('button')!.click()
        await nextTick()
        expect(root.querySelector('p')!.title).toBe('blue')
        expect(root.textContent).toBe('nextB')
      },
    )
    expect(vapor.after).toBe(vdom.after)
  })
})
