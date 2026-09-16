import { nextTick, ref } from '@vue/runtime-dom'
import { renderParity } from './_utils'

describe('v-match VDOM / Vapor parity', () => {
  test('SFC root match preserves bindings, nested scopes and branch identity', async () => {
    await renderParity(
      {
        Panel: '<template><slot :text="data.slot"/></template>',
        App: `<template v-match="data.result">
          <section v-when="{ kind: 'ok', const text }" :title="text">
            <button @click="data.clicked.push(text)">{{ text }}</button>
            <b v-for="text in text">{{ text }}</b>
            <components.Panel v-slot="{ text }"><i>{{ text }}</i></components.Panel>
            <template v-match="text"><em v-when="const text">{{ text }}</em></template>
          </section>
          <p v-when="_">empty</p>
        </template>`,
      },
      () =>
        ref({
          result: { kind: 'ok', text: 'ab' },
          slot: 'slot',
          clicked: [] as string[],
        }),
      async (data, root) => {
        const section = root.querySelector('section')!
        const button = root.querySelector('button')!
        expect(section.textContent!.replace(/\s/g, '')).toBe('ababslotab')
        button.click()
        data.value.result.text = 'cd'
        data.value.slot = 'updated'
        await nextTick()
        expect(root.querySelector('section')).toBe(section)
        expect(section.title).toBe('cd')
        expect(section.textContent!.replace(/\s/g, '')).toBe('cdcdupdatedcd')
        button.click()
        expect(data.value.clicked).toEqual(['ab', 'cd'])
        data.value.result.kind = 'err'
        await nextTick()
        expect(root.querySelector('section')).toBeNull()
        expect(root.textContent).toBe('empty')
      },
    )
  })

  test('template arm keys remount while empty arms stop fallthrough', async () => {
    await renderParity(
      {
        App: `<template><template v-match="data"><template v-when="{ const id }" :key="id"><input :value="id"/></template><template v-when="null"></template><b v-when="_">fallback</b></template></template>`,
      },
      () => ref<unknown>({ id: 'a' }),
      async (data, root) => {
        const first = root.querySelector('input')
        data.value = { id: 'b' }
        await nextTick()
        expect(root.querySelector('input')).not.toBe(first)
        data.value = null
        await nextTick()
        expect(root.textContent).toBe('')
        data.value = 42
        await nextTick()
        expect(root.textContent).toBe('fallback')
      },
    )
  })

  test.each(['input', 'template'])(
    'v-once retains bindings and arm identity on %s',
    async tag => {
      const arm =
        tag === 'input'
          ? `<input v-when="{ kind: 'a', const value }" v-once :value="value"/>`
          : `<template v-when="{ kind: 'a', const value }" v-once><input :value="value"/></template>`
      await renderParity(
        {
          App: `<template><template v-match="data">${arm}<input v-when="{ kind: 'b', const value }" :value="value"/></template></template>`,
        },
        () => ref({ kind: 'a', value: 'first' }),
        async (data, root) => {
          const first = root.querySelector('input')!
          expect(first.value).toBe('first')
          data.value.value = 'updated'
          await nextTick()
          expect(root.querySelector('input')).toBe(first)
          expect(first.value).toBe('first')
          data.value = { kind: 'b', value: 'second' }
          await nextTick()
          expect(root.querySelector('input')).not.toBe(first)
          expect(root.querySelector('input')!.value).toBe('second')
        },
      )
    },
  )

  test('reactive selection, guards, rest and event binding lifetime', async () => {
    const results = await renderParity(
      {
        App: `<template><section v-match="data.value"><button v-when="{ kind: 'ok', const value, ...const rest } if (value > 0)" @click="data.clicked.push(value)">{{ value }}:{{ rest.label }}</button><p v-when="_">empty</p></section></template>`,
      },
      () =>
        ref({
          value: { kind: 'ok', value: 1, label: 'first' },
          clicked: [] as number[],
        }),
      async (data, root) => {
        expect(root.textContent).toBe('1:first')
        const button = root.querySelector('button')!
        button.click()
        data.value.value = { kind: 'ok', value: 2, label: 'second' }
        await nextTick()
        expect(root.querySelector('button')).toBe(button)
        button.click()
        expect(data.value.clicked).toEqual([1, 2])
        expect(root.textContent).toBe('2:second')
        data.value.value.value = 0
        await nextTick()
        expect(root.querySelector('button')).toBeNull()
      },
    )
    expect(results.vdom.text).toBe('empty')
    expect(results.vapor.text).toBe(results.vdom.text)
  })

  test('branch bindings compose with component props and scoped slots', async () => {
    await renderParity(
      {
        Panel: '<template><div><slot :suffix="data.suffix"/></div></template>',
        App: `<template><template v-match="data.result"><components.Panel v-when="{ const text }" :title="text"><template #default="{ suffix }"><span>{{ text }}:{{ suffix }}</span><template v-match="suffix"><b v-when="const ending">{{ ending }}</b></template></template></components.Panel><i v-when="_">empty</i></template></template>`,
      },
      () => ref({ result: { text: 'first' }, suffix: '!' }),
      async (data, root) => {
        expect(root.textContent).toBe('first:!!')
        expect(root.querySelector('div')!.title).toBe('first')
        data.value.result.text = 'second'
        data.value.suffix = '?'
        await nextTick()
        expect(root.textContent).toBe('second:??')
        expect(root.querySelector('div')!.title).toBe('second')
      },
    )
  })

  test('nested match and array rest react to in-place updates', async () => {
    const results = await renderParity(
      {
        App: `<template><template v-match="data"><template v-when="[const first, ...const tail]"><template v-match="first"><b v-when="1">one:{{ tail.join(',') }}</b><b v-when="const other">{{ other }}</b></template></template><p v-when="[]">empty</p></template></template>`,
      },
      () => ref([1, 2]),
      async (data, root) => {
        expect(root.textContent).toBe('one:2')
        data.value.push(3)
        await nextTick()
        expect(root.textContent).toBe('one:2,3')
        data.value = []
      },
    )
    expect(results.vdom.text).toBe('empty')
    expect(results.vapor.text).toBe('empty')
  })

  test('arm bindings shadow setup, loop and slot bindings without leaking', async () => {
    await renderParity(
      {
        Panel: '<template><slot :value="data.slot"/></template>',
        App: `<script setup>
          const data = _data;
          const components = _components;
          const value = 'setup';
        </script><template>
          <div v-for="value in data.rows">
            <template v-match="value">
              <section v-when="{ tag: value.tag, const value } if (value === 'arm')" :title="value">
                <b>{{ value }}</b>
                <i v-for="value in value">{{ value }}</i>
                <components.Panel v-slot="{ value }"><em>{{ value }}</em></components.Panel>
                <strong>{{ value }}</strong>
                <template v-match="value"><small v-when="const value">{{ value }}</small></template>
              </section>
              <u v-when="const value">{{ value.value }}</u>
            </template>
            <p>{{ value.value }}</p>
          </div>
          <footer>{{ value }}</footer>
        </template>`,
      },
      () =>
        ref({
          rows: [
            { tag: 'setup', value: 'arm' },
            { tag: 'setup', value: 'other' },
          ],
          slot: 'slot',
        }),
      async (data, root) => {
        const text = () => root.textContent!.replace(/\s/g, '')
        expect(text()).toBe('armarmslotarmarmarmotherothersetup')
        expect(root.querySelector('section')!.title).toBe('arm')
        data.value.slot = 'updated'
        data.value.rows[0].value = 'fallback'
        await nextTick()
        expect(text()).toBe('fallbackfallbackotherothersetup')
      },
    )
  })

  test('$event is local to an inline handler and shadows an arm binding', async () => {
    await renderParity(
      {
        App: `<template><template v-match="data.value">
          <button v-when="const $event if ($event === 'arm')" :title="$event" @click="data.clicked.push($event.type)">{{ $event }}</button>
          <i v-when="_"/>
        </template></template>`,
      },
      () => ref({ value: 'arm', clicked: [] as string[] }),
      (data, root) => {
        const button = root.querySelector('button')!
        expect(button.title).toBe('arm')
        expect(button.textContent).toBe('arm')
        button.click()
        expect(data.value.clicked).toEqual(['click'])
      },
    )
  })

  test('props and component slot parameters occupy different arm scopes', async () => {
    await renderParity(
      {
        Panel: `<script setup>
          const data = _data;
          defineProps(['label']);
        </script><template><div :title="label"><slot :value="data.slot"/></div></template>`,
        Child: `<script setup>
          const data = _data;
          const components = _components;
          defineProps(['value']);
        </script><template>
          <template v-match="data.row">
            <components.Panel v-when="{ const value } if (value === 'arm')" :label="value" v-slot="{ value }"><b>{{ value }}</b></components.Panel>
            <i v-when="_"/>
          </template>
          <p>{{ value }}</p>
        </template>`,
        App: '<template><components.Child :value="data.prop"/></template>',
      },
      () => ref({ row: { value: 'arm' }, prop: 'prop', slot: 'slot' }),
      async (data, root) => {
        expect(root.querySelector('div')!.title).toBe('arm')
        expect(root.querySelector('b')!.textContent).toBe('slot')
        expect(root.querySelector('p')!.textContent).toBe('prop')
        data.value.prop = 'updated'
        data.value.slot = 'nested'
        await nextTick()
        expect(root.querySelector('div')!.title).toBe('arm')
        expect(root.querySelector('b')!.textContent).toBe('nested')
        expect(root.querySelector('p')!.textContent).toBe('updated')
      },
    )
  })
})
