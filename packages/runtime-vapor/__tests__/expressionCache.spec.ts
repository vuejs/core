import { nextTick, ref, shallowRef } from '@vue/runtime-dom'
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

  // #15725
  test('a merged listener runs only on its event', async () => {
    const { vdom, vapor } = await renderParity(
      {
        App: `<script setup>
          const attrs = { id: 'a' }
          const log = _data.value
          const hit = key => log.push(key)
        </script>
        <template>
          <div v-bind="attrs" @click="hit('call')" @focus="hit('call')"></div>
          <p v-bind="attrs" @click="hit($event.type)" @focus="hit($event.type)"></p>
        </template>`,
      },
      () => shallowRef<string[]>([]),
      async (data, root) => {
        expect(data.value).toEqual([])
        root.querySelector('div')!.click()
        root.querySelector('p')!.click()
        expect(data.value).toEqual(['call', 'click'])
      },
    )
    expect(vapor.after).toBe(vdom.after)
  })

  test('a merged listener does not read its member on render', async () => {
    const { vdom, vapor } = await renderParity(
      {
        App: `<script setup>
          import { shallowRef } from 'vue'
          const attrs = { id: 'a' }
          const log = _data.value
          const user = shallowRef(null)
          const login = () => {
            user.value = { profile: { save: e => log.push(e.type) } }
          }
        </script>
        <template>
          <button @click="login">login</button>
          <div v-bind="attrs" @click="user.profile.save" @focus="user.profile.save"></div>
        </template>`,
      },
      () => shallowRef<string[]>([]),
      async (data, root) => {
        root.querySelector('button')!.click()
        await nextTick()
        root.querySelector('div')!.click()
        expect(data.value).toEqual(['click'])
      },
    )
    expect(vapor.after).toBe(vdom.after)
  })

  test('a merged listener evaluates a cached binding on its event', async () => {
    const { vdom, vapor } = await renderParity(
      {
        App: `<script setup>
          const attrs = { id: 'a' }
          const log = _data.value
          let suffix = 1
          const label = key => key + suffix
          const go = value => log.push(value)
          const bump = () => suffix++
        </script>
        <template>
          <button @click="bump">bump</button>
          <div v-bind="attrs" :title="label('k')" :data-k="label('k')" @click="go(label('k'))"></div>
        </template>`,
      },
      () => shallowRef<string[]>([]),
      async (data, root) => {
        root.querySelector('button')!.click()
        root.querySelector('div')!.click()
        expect(data.value).toEqual(['k2'])
      },
    )
    expect(vapor.after).toBe(vdom.after)
  })

  test('a listener merged after v-model assigns a binding read on render', async () => {
    const { vdom, vapor } = await renderParity(
      {
        App: `<script setup>
          import { ref, shallowRef } from 'vue'
          const a = ref('')
          const b = ref('')
          const listeners = shallowRef({ focus: () => {} })
        </script>
        <template>
          <input v-model="a" v-on="listeners" @click="listeners = {}">
          <input v-model="b" v-on="listeners" @focus="b = 'b'">
          <p>{{ Object.keys(listeners).join() }}</p>
        </template>`,
      },
      () => ref(null),
      async (data, root) => {
        expect(root.querySelector('p')!.textContent).toBe('focus')
        root.querySelector('input')!.click()
        await nextTick()
        expect(root.querySelector('p')!.textContent).toBe('')
      },
    )
    expect(vapor.after).toBe(vdom.after)
  })
  test('a dynamic event handler assigns a binding read on render', async () => {
    const { vdom, vapor } = await renderParity(
      {
        App: `<script setup>
          import { ref } from 'vue'
          const attrs = { id: 'a' }
          const n = ref(0)
          const event = ref('focus')
        </script>
        <template>
          <div v-bind="attrs" :title="n" :data-n="n" @click="n++" @[event]="n++">{{ n }}</div>
        </template>`,
      },
      () => ref(null),
      async (data, root) => {
        const div = root.querySelector('div')!
        div.dispatchEvent(new Event('focus'))
        await nextTick()
        expect(div.textContent).toBe('1')
        div.click()
        await nextTick()
        expect(div.textContent).toBe('2')
      },
    )
    expect(vapor.after).toBe(vdom.after)
  })

  test('a merged listener is not shadowed by a cached binding of the same name', async () => {
    const { vdom, vapor } = await renderParity(
      {
        App: `<script setup>
          import { ref } from 'vue'
          const attrs = { id: 'a' }
          const log = _data.value
          const on_click = ref('x')
          const hit = () => log.push('hit')
        </script>
        <template>
          <div v-bind="attrs" :title="on_click" :data-x="on_click" @click="hit()"></div>
        </template>`,
      },
      () => shallowRef<string[]>([]),
      async (data, root) => {
        root.querySelector('div')!.click()
        expect(data.value).toEqual(['hit'])
      },
    )
    expect(vapor.after).toBe(vdom.after)
  })
  test('a merged listener avoids the names of setup bindings', async () => {
    const { vdom, vapor } = await renderParity(
      {
        App: `<script setup>
          import { ref } from 'vue'
          const attrs = { id: 'a' }
          const _on_click = ref(0)
        </script>
        <template>
          <div v-bind="attrs" @click="_on_click++">{{ _on_click }}</div>
        </template>`,
      },
      () => ref(null),
      async (data, root) => {
        const div = root.querySelector('div')!
        div.click()
        await nextTick()
        expect(div.textContent).toBe('1')
      },
    )
    expect(vapor.after).toBe(vdom.after)
  })
})
