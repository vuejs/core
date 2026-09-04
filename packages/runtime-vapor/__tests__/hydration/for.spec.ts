import { nextTick, ref } from '@vue/runtime-dom'
import { formatHtml, setupHydrationTest, testHydration } from './_helpers'

setupHydrationTest()

describe('Vapor Mode hydration', () => {
  describe('for', () => {
    test('basic v-for', async () => {
      const { container, data } = await testHydration(
        `<template>
          <span v-for="item in data" :key="item">{{ item }}</span>
        </template>`,
        undefined,
        ref(['a', 'b', 'c']),
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span>a</span><span>b</span><span>c</span><!--]-->
        "
      `,
      )

      data.value.push('d')
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span>a</span><span>b</span><span>c</span><span>d</span><!--]-->
        "
      `,
      )
    })

    test('empty v-for', async () => {
      const { container, data } = await testHydration(
        `<template>
          <span v-for="item in data" :key="item">{{ item }}</span>
        </template>`,
        undefined,
        ref([]),
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><!--]-->
        "
      `,
      )

      data.value.push('a')
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span>a</span><!--]-->
        "
      `,
      )
    })

    test('v-for with insertion parent + sibling component', async () => {
      const { container, data } = await testHydration(
        `<template>
          <div>
            <span v-for="item in data" :key="item">{{ item }}</span>
          </div>
          <components.Child/>
        </template>`,
        {
          Child: `<template><div>{{data.length}}</div></template>`,
        },
        ref(['a', 'b', 'c']),
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div>
        <!--[--><span>a</span><span>b</span><span>c</span><!--]-->
        </div><div>3</div><!--]-->
        "
      `,
      )

      data.value.push('d')
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div>
        <!--[--><span>a</span><span>b</span><span>c</span><span>d</span><!--]-->
        </div><div>4</div><!--]-->
        "
      `,
      )
    })

    test('v-for with static sibling + root sibling component', async () => {
      const { container, data } = await testHydration(
        `<template>
          <div>
            <span v-for="item in data" :key="item">{{ item }}</span>
            <div>1</div>
          </div>
          <components.Child/>
        </template>`,
        {
          Child: `<template><div>{{data.length}}</div></template>`,
        },
        ref(['a', 'b', 'c']),
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div>
        <!--[--><span>a</span><span>b</span><span>c</span><!--]-->
        <div>1</div></div><div>3</div><!--]-->
        "
      `,
      )

      data.value.push('d')
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div>
        <!--[--><span>a</span><span>b</span><span>c</span><span>d</span><!--]-->
        <div>1</div></div><div>4</div><!--]-->
        "
      `,
      )
    })

    test('v-for with insertion anchor', async () => {
      const { container, data } = await testHydration(
        `<template>
          <div>
            <span/>
            <span v-for="item in data" :key="item">{{ item }}</span>
            <span/>
          </div>
        </template>`,
        undefined,
        ref(['a', 'b', 'c']),
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><span>a</span><span>b</span><span>c</span><!--]-->
        <span></span></div>"
      `,
      )

      data.value.push('d')
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><span>a</span><span>b</span><span>c</span><span>d</span><!--]-->
        <span></span></div>"
      `,
      )

      data.value.splice(0, 1)
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><span>b</span><span>c</span><span>d</span><!--]-->
        <span></span></div>"
      `,
      )
    })

    test('consecutive v-for with insertion anchor', async () => {
      const { container, data } = await testHydration(
        `<template>
          <div>
            <span/>
            <span v-for="item in data" :key="item">{{ item }}</span>
            <span v-for="item in data" :key="item">{{ item }}</span>
            <span/>
          </div>
        </template>`,
        undefined,
        ref(['a', 'b', 'c']),
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><span>a</span><span>b</span><span>c</span><!--]-->
        <!--[--><span>a</span><span>b</span><span>c</span><!--]-->
        <span></span></div>"
      `,
      )

      data.value.push('d')
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><span>a</span><span>b</span><span>c</span><span>d</span><!--]-->
        <!--[--><span>a</span><span>b</span><span>c</span><span>d</span><!--]-->
        <span></span></div>"
      `,
      )

      data.value.splice(0, 2)
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><span>c</span><span>d</span><!--]-->
        <!--[--><span>c</span><span>d</span><!--]-->
        <span></span></div>"
      `,
      )
    })

    test('v-for on component', async () => {
      const { container, data } = await testHydration(
        `<template>
          <div>
            <components.Child v-for="item in data" :key="item"/>
          </div>
        </template>`,
        {
          Child: `<template><div>comp</div></template>`,
        },
        ref(['a', 'b', 'c']),
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><div>comp</div><div>comp</div><div>comp</div><!--]-->
        </div>"
      `,
      )

      data.value.push('d')
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><div>comp</div><div>comp</div><div>comp</div><div>comp</div><!--]-->
        </div>"
      `,
      )
    })

    test('v-for on component with slots', async () => {
      const { container, data } = await testHydration(
        `<template>
          <div>
            <components.Child v-for="item in data" :key="item">
              <span>{{ item }}</span>
            </components.Child>
          </div>
        </template>`,
        {
          Child: `<template><slot/></template>`,
        },
        ref(['a', 'b', 'c']),
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[-->
        <!--[--><span>a</span><!--]-->
        <!--[--><span>b</span><!--]-->
        <!--[--><span>c</span><!--]-->
        <!--]-->
        </div>"
      `,
      )

      data.value.push('d')
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[-->
        <!--[--><span>a</span><!--]-->
        <!--[--><span>b</span><!--]-->
        <!--[--><span>c</span><!--]-->
        <span>d</span><!--slot--><!--]-->
        </div>"
      `,
      )
    })

    test('on fragment component', async () => {
      const { container, data } = await testHydration(
        `<template>
          <div>
            <components.Child v-for="item in data" :key="item"/>
          </div>
        </template>`,
        {
          Child: `<template><div>foo</div>-bar-</template>`,
        },
        ref(['a', 'b', 'c']),
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[-->
        <!--[--><div>foo</div>-bar-<!--]-->
        <!--[--><div>foo</div>-bar-<!--]-->
        <!--[--><div>foo</div>-bar-<!--]-->
        <!--]-->
        </div>"
      `,
      )

      data.value.push('d')
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[-->
        <!--[--><div>foo</div>-bar-<!--]-->
        <!--[--><div>foo</div>-bar-<!--]-->
        <!--[--><div>foo</div>-bar-<!--]-->
        <div>foo</div>-bar-<!--]-->
        </div>"
      `,
      )
    })

    test('on component with non-hydration node', async () => {
      const data = ref({ show: true, msg: 'foo' })
      const { container } = await testHydration(
        `<template>
          <div>
            <components.Child v-for="item in 2" :key="item"/>
          </div>
        </template>`,
        {
          Child: `<template>
            <div>
              <div>
                <div v-if="data.show">{{ data.msg }}</div>
              </div>
              <span>non-hydration node</span>
            </div>
          </template>`,
        },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><div><div><div>foo</div><!--if--></div><span>non-hydration node</span></div><div><div><div>foo</div><!--if--></div><span>non-hydration node</span></div><!--]-->
        </div>"
      `,
      )

      data.value.msg = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><div><div><div>bar</div><!--if--></div><span>non-hydration node</span></div><div><div><div>bar</div><!--if--></div><span>non-hydration node</span></div><!--]-->
        </div>"
      `,
      )

      data.value.show = false
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
        "<div>
        <!--[--><div><div><!--if--></div><span>non-hydration node</span></div><div><div><!--if--></div><span>non-hydration node</span></div><!--]-->
        </div>"
      `)

      data.value.show = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
        "<div>
        <!--[--><div><div><div>bar</div><!--if--></div><span>non-hydration node</span></div><div><div><div>bar</div><!--if--></div><span>non-hydration node</span></div><!--]-->
        </div>"
      `)
    })

    test('multi-root v-if as a keyed template row', async () => {
      const data = ref({ items: [1, 2], show: true })
      const { container } = await testHydration(
        `<template>
          <ul>
            <template v-for="item in data.items" :key="item">
              <template v-if="data.show">
                <li>{{ item }}a</li>
                <li>{{ item }}b</li>
              </template>
            </template>
          </ul>
        </template>`,
        {},
        data,
      )
      const ul = container.querySelector('ul')!
      expect(ul.innerHTML).toBe(
        `<!--[--><!--[--><!--[--><li>1a</li><li>1b</li><!--]--><!--]--><!--[--><!--[--><li>2a</li><li>2b</li><!--]--><!--]--><!--]-->`,
      )
      data.value.show = false
      await nextTick()
      expect(ul.innerHTML).toBe(
        `<!--[--><!--[--><!--[--><!--]--><!--]--><!--[--><!--[--><!--]--><!--]--><!--]-->`,
      )
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()
      expect(
        `Hydration completed but contains mismatches.`,
      ).not.toHaveBeenWarned()
    })

    test('with non-hydration node', async () => {
      const data = ref({ show: true, msg: 'foo' })
      const { container } = await testHydration(
        `<template>
          <div>
            <div v-for="item in 2">
              <div>
                <div v-if="data.show">{{ data.msg }}</div>
              </div>
              <span>non-hydration node</span>
            </div>
          </div>
        </template>`,
        {},
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><div><div><div>foo</div><!--if--></div><span>non-hydration node</span></div><div><div><div>foo</div><!--if--></div><span>non-hydration node</span></div><!--]-->
        </div>"
      `,
      )

      data.value.msg = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><div><div><div>bar</div><!--if--></div><span>non-hydration node</span></div><div><div><div>bar</div><!--if--></div><span>non-hydration node</span></div><!--]-->
        </div>"
      `,
      )

      data.value.show = false
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
        "<div>
        <!--[--><div><div><!--if--></div><span>non-hydration node</span></div><div><div><!--if--></div><span>non-hydration node</span></div><!--]-->
        </div>"
      `)

      data.value.show = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
        "<div>
        <!--[--><div><div><div>bar</div><!--if--></div><span>non-hydration node</span></div><div><div><div>bar</div><!--if--></div><span>non-hydration node</span></div><!--]-->
        </div>"
      `)
    })
  })
})
