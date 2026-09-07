import { nextTick, ref } from '@vue/runtime-dom'
import { renderEffect } from '../src'
import { renderParity } from './_utils'

// Works as a vdom function directive (mounted + updated with a binding) and
// as a vapor directive (a getter), so one definition serves both modes.
const vDir = (el: Element, b: any) => {
  if (typeof b === 'function') {
    renderEffect(() => el.setAttribute('data-v', b()))
  } else {
    el.setAttribute('data-v', b.value)
  }
}
const withDir = (template: string) =>
  `<script setup>const data = _data; const components = _components; const vDir = components.vDir</script>${template}`

describe('v-once', () => {
  describe('directive helpers inside a compiled v-once region', () => {
    test('v-show on an element and on a component', async () => {
      for (const App of [
        `<template><div v-show="data.show" v-once>x</div></template>`,
        `<template><components.Leaf v-show="data.show" v-once/></template>`,
      ]) {
        const { vdom, vapor } = await renderParity(
          { Leaf: `<template><div>x</div></template>`, App },
          () => ref({ show: true }),
          data => {
            data.value.show = false
          },
        )
        expect(vdom.after).toBe('<div>x</div>')
        expect(vapor.after).toBe(vdom.after)
      }
    })

    test('native v-model', async () => {
      const values: string[] = []
      await renderParity(
        { App: `<template><input v-model="data.text" v-once></template>` },
        () => ref({ text: 'a' }),
        async (data, root) => {
          data.value.text = 'b'
          await nextTick()
          values.push((root.querySelector('input') as HTMLInputElement).value)
        },
      )
      expect(values).toEqual(['a', 'a'])
    })

    test('custom directive', async () => {
      const { vdom, vapor } = await renderParity(
        {
          App: withDir(
            `<template><div v-dir="data.val" v-once>x</div></template>`,
          ),
        },
        () => ref({ val: 'a' }),
        data => {
          data.value.val = 'b'
        },
        { vDir },
      )
      expect(vdom.after).toBe('<div data-v="a">x</div>')
      expect(vapor.after).toBe(vdom.after)
    })

    test('the same helpers stay frozen inside <slot v-once> content', async () => {
      const Child = `<template><div><slot v-once/></div></template>`
      const show = await renderParity(
        {
          Child,
          App: `<template><components.Child><div v-show="data.show">x</div></components.Child></template>`,
        },
        () => ref({ show: true }),
        data => {
          data.value.show = false
        },
      )
      expect(show.vdom.after).toBe('<div><div>x</div></div>')
      expect(show.vapor.after).toBe('<div><div>x</div><!--slot--></div>')

      const dir = await renderParity(
        {
          Child,
          App: withDir(
            `<template><components.Child><div v-dir="data.val">x</div></components.Child></template>`,
          ),
        },
        () => ref({ val: 'a' }),
        data => {
          data.value.val = 'b'
        },
        { vDir },
      )
      expect(dir.vdom.after).toBe('<div><div data-v="a">x</div></div>')
      expect(dir.vapor.after).toBe(
        '<div><div data-v="a">x</div><!--slot--></div>',
      )

      const values: string[] = []
      await renderParity(
        {
          Child,
          App: `<template><components.Child><input v-model="data.text"></components.Child></template>`,
        },
        () => ref({ text: 'a' }),
        async (data, root) => {
          data.value.text = 'b'
          await nextTick()
          values.push((root.querySelector('input') as HTMLInputElement).value)
        },
      )
      expect(values).toEqual(['a', 'a'])
    })
  })

  describe('slot content of a v-once component', () => {
    const Child = `<script setup>import { ref } from 'vue'; const data = _data; const n = ref(0); data.value.bump = () => n.value++</script><template><div>{{ n }}<slot :n="n"/></div></template>`

    test('stays live for parent state (the child re-runs it)', async () => {
      const { vdom, vapor } = await renderParity(
        {
          Child,
          App: `<template><components.Child v-once><span>{{ data.msg }}</span></components.Child></template>`,
        },
        () => ref({ msg: 'a' }),
        data => {
          data.value.msg = 'b'
        },
      )
      expect(vdom.text).toBe('0b')
      expect(vapor.text).toBe(vdom.text)
    })

    test('stays live for child-driven scoped slot props', async () => {
      const { vdom, vapor } = await renderParity(
        {
          Child,
          App: `<template><components.Child v-once><template #default="{ n }"><span>{{ n }}</span></template></components.Child></template>`,
        },
        () => ref({}),
        data => data.value.bump(),
      )
      expect(vdom.text).toBe('11')
      expect(vapor.text).toBe(vdom.text)
    })

    test('props stay frozen while the slot content is live', async () => {
      const { vdom, vapor } = await renderParity(
        {
          Leaf: `<script setup>const props = defineProps(['label']); const data = _data; </script><template><div>{{ props.label }}<slot/></div></template>`,
          App: `<template><components.Leaf v-once :label="data.msg"><i>{{ data.msg }}</i></components.Leaf></template>`,
        },
        () => ref({ msg: 'a' }),
        data => {
          data.value.msg = 'b'
        },
      )
      expect(vdom.text).toBe('ab')
      expect(vapor.text).toBe(vdom.text)
    })

    test('the slot set stays frozen', async () => {
      const { vdom, vapor } = await renderParity(
        {
          Named: `<template><div><slot name="b"/></div></template>`,
          App: `<template><components.Named v-once><template v-for="n in data.names" #[n]>{{ n }}</template></components.Named></template>`,
        },
        () => ref({ names: ['a'] }),
        data => {
          data.value.names = ['a', 'b']
        },
      )
      expect(vdom.text).toBe('')
      expect(vapor.text).toBe(vdom.text)
    })
  })

  // vdom caches the v-once vnode per component instance (`_cache[i]`) and
  // drops v-once where nothing can be cached. Vapor freezes per creation
  // instead; these cells pin that on purpose, with the vdom result recorded.
  describe('intentionally not aligned with vdom', () => {
    test('v-once inside v-for freezes each row separately', async () => {
      const { vdom, vapor } = await renderParity(
        {
          App: `<template><div v-for="i in data.list" :key="i"><span v-once>{{ i }}</span></div></template>`,
        },
        () => ref({ list: [1, 2] }),
        data => {
          data.value.list = [1, 2, 3]
        },
      )
      expect(vdom.text).toBe('111')
      expect(vapor.text).toBe('123')
    })

    test('v-once on v-else freezes the branch instance', async () => {
      const { vdom, vapor } = await renderParity(
        {
          App: `<template><p v-if="data.a">A</p><p v-else v-once>{{ data.msg }}</p></template>`,
        },
        () => ref({ a: false, msg: 'x' }),
        data => {
          data.value.msg = 'y'
        },
      )
      expect(vdom.text).toBe('y')
      expect(vapor.text).toBe('x')
    })

    test('v-once on a slot template freezes that slot', async () => {
      const { vdom, vapor } = await renderParity(
        {
          Child: `<template><div><slot/></div></template>`,
          App: `<template><components.Child><template #default v-once><span>{{ data.msg }}</span></template></components.Child></template>`,
        },
        () => ref({ msg: 'a' }),
        data => {
          data.value.msg = 'b'
        },
      )
      expect(vdom.text).toBe('b')
      expect(vapor.text).toBe('a')
    })

    test('fallthrough attrs onto a v-once single root stay frozen', async () => {
      const { vdom, vapor } = await renderParity(
        {
          Leaf: `<template><div>leaf</div></template>`,
          Wrapper: `<template><components.Leaf v-once/></template>`,
          App: `<template><components.Wrapper :class="data.cls"/></template>`,
        },
        () => ref({ cls: 'a' }),
        data => {
          data.value.cls = 'b'
        },
      )
      expect(vdom.after).toBe('<div class="b">leaf</div>')
      expect(vapor.after).toBe('<div class="a">leaf</div>')
    })

    test('event handlers read the current binding', async () => {
      const calls: string[] = []
      await renderParity(
        {
          App: `<template><button v-once @click="data.fn">x</button></template>`,
        },
        () => ref({ fn: () => calls.push('old') }),
        async (data, root) => {
          data.value.fn = () => calls.push('new')
          await nextTick()
          ;(root.querySelector('button') as HTMLButtonElement).click()
        },
      )
      expect(calls).toEqual(['old', 'new'])
    })
  })
})
