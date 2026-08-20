import { nextTick, reactive, ref } from '@vue/runtime-dom'
import { formatHtml, setupHydrationTest, testHydration } from './_helpers'

setupHydrationTest()

describe('Vapor Mode hydration', () => {
  describe('if', () => {
    test('basic toggle - true -> false', async () => {
      const data = ref(true)
      const { container } = await testHydration(
        `<template>
          <div v-if="data">foo</div>
        </template>`,
        undefined,
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div>foo</div><!--if-->"`,
      )

      data.value = false
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<!--if-->"`,
      )
    })

    test('basic toggle - false -> true', async () => {
      const data = ref(false)
      const { container } = await testHydration(
        `<template>
          <div v-if="data">foo</div>
        </template>`,
        undefined,
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`"<!---->"`)

      data.value = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div>foo</div><!---->"`,
      )
    })

    test('v-if decodes packed branch shapes and keyed index during hydration', async () => {
      const code = `<template>
        <template v-if="data.ok"><span>foo</span>bar</template>
        <template v-else><div>baz</div></template>
      </template>`

      const truthy = ref({ ok: true })
      const { container: trueContainer } = await testHydration(
        code,
        undefined,
        truthy,
      )
      expect(formatHtml(trueContainer.innerHTML)).toMatchInlineSnapshot(
        `"
<!--[--><span>foo</span>bar<!--]-->
"`,
      )

      truthy.value.ok = false
      await nextTick()
      expect(formatHtml(trueContainer.innerHTML)).toMatchInlineSnapshot(
        `"
<!--[--><div>baz</div><!--]-->
"`,
      )

      const falsy = ref({ ok: false })
      const { container: falseContainer } = await testHydration(
        code,
        undefined,
        falsy,
      )
      expect(formatHtml(falseContainer.innerHTML)).toMatchInlineSnapshot(
        `"<div>baz</div><!--if-->"`,
      )

      falsy.value.ok = true
      await nextTick()
      expect(formatHtml(falseContainer.innerHTML)).toMatchInlineSnapshot(
        `"<span>foo</span>bar<!--if-->"`,
      )
    })

    test('v-if on insertion parent', async () => {
      const data = ref(true)
      const { container } = await testHydration(
        `<template>
          <div v-if="data">
            <components.Child/>
          </div>
        </template>`,
        { Child: `<template>foo</template>` },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div>foo</div><!--if-->"`,
      )

      data.value = false
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<!--if-->"`,
      )

      data.value = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div>foo</div><!--if-->"`,
      )
    })

    test('v-if/else-if/else chain - switch branches', async () => {
      const data = ref('a')
      const { container } = await testHydration(
        `<template>
          <div v-if="data === 'a'">foo</div>
          <div v-else-if="data === 'b'">bar</div>
          <div v-else>baz</div>
        </template>`,
        undefined,
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div>foo</div><!--if-->"`,
      )

      data.value = 'b'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div>bar</div><!--if--><!--if-->"`,
      )

      data.value = 'c'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div>baz</div><!--if--><!--if-->"`,
      )

      data.value = 'a'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div>foo</div><!--if-->"`,
      )
    })

    test('v-if/else with sibling components and elements', async () => {
      const data = ref('a')
      const { container } = await testHydration(
        `<script setup>
          const msg = _data
          const { Comp } = _components
        </script>
        <template>
          <div>
            <Comp/>
            <div>11</div>
            <div v-if="msg === 'a'">foo</div>
            <div v-else>baz</div>
            <div>11</div>
            <Comp/>
          </div>
        </template>`,
        {
          Comp: `<template><span>comp</span></template>`,
        },
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span>comp</span><div>11</div><div>foo</div><!--if--><div>11</div><span>comp</span></div>"`,
      )

      data.value = 'b'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span>comp</span><div>11</div><div>baz</div><!--if--><div>11</div><span>comp</span></div>"`,
      )
    })

    test('nested if', async () => {
      const data = reactive({ outer: true, inner: true })
      const { container } = await testHydration(
        `<template>
          <div v-if="data.outer">
            <span>outer</span>
            <div v-if="data.inner">inner</div>
          </div>
        </template>`,
        undefined,
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span>outer</span><div>inner</div><!--if--></div><!--if-->"`,
      )

      data.inner = false
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span>outer</span><!--if--></div><!--if-->"`,
      )

      data.outer = false
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<!--if-->"`,
      )
    })

    test('on component', async () => {
      const data = ref(true)
      const { container } = await testHydration(
        `<template>
          <components.Child v-if="data"/>
        </template>`,
        { Child: `<template>foo</template>` },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"foo<!--if-->"`,
      )

      data.value = false
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<!--if-->"`,
      )
    })

    test('consecutive if node', async () => {
      const data = ref(true)
      const { container } = await testHydration(
        `<template>
          <components.Child v-if="data"/>
        </template>`,
        { Child: `<template><div v-if="data">foo</div></template>` },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div>foo</div><!--if--><!--if-->"`,
      )

      data.value = false
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<!--if-->"`,
      )

      data.value = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div>foo</div><!--if--><!--if-->"`,
      )
    })

    test('mixed prepend and insertion anchor', async () => {
      const data = reactive({
        show: true,
        foo: 'foo',
        bar: 'bar',
        qux: 'qux',
      })
      const { container } = await testHydration(
        `<template>
          <components.Child/>
        </template>`,
        {
          Child: `<template>
            <span v-if="data.show">
              <span v-if="data.show">{{data.foo}}</span>
              <span v-if="data.show">{{data.bar}}</span>
              <span>baz</span>
              <span v-if="data.show">{{data.qux}}</span>
              <span>quux</span>
            </span>
          </template>`,
        },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<span><span>foo</span><!--if--><span>bar</span><!--if--><span>baz</span><span>qux</span><!--if--><span>quux</span></span><!--if-->"`,
      )

      data.qux = 'qux1'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<span><span>foo</span><!--if--><span>bar</span><!--if--><span>baz</span><span>qux1</span><!--if--><span>quux</span></span><!--if-->"`,
      )

      data.foo = 'foo1'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<span><span>foo1</span><!--if--><span>bar</span><!--if--><span>baz</span><span>qux1</span><!--if--><span>quux</span></span><!--if-->"`,
      )
    })

    test('v-if/else-if/else chain on component - switch branches', async () => {
      const data = ref('a')
      const { container } = await testHydration(
        `<template>
          <components.Child1 v-if="data === 'a'"/>
          <components.Child2 v-else-if="data === 'b'"/>
          <components.Child3 v-else/>
        </template>`,
        {
          Child1: `<template><span>{{data}} child1</span></template>`,
          Child2: `<template><span>{{data}} child2</span></template>`,
          Child3: `<template><span>{{data}} child3</span></template>`,
        },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<span>a child1</span><!--if-->"`,
      )

      data.value = 'b'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<span>b child2</span><!--if--><!--if-->"`,
      )

      data.value = 'c'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<span>c child3</span><!--if--><!--if-->"`,
      )

      data.value = 'a'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<span>a child1</span><!--if-->"`,
      )
    })

    test('on component with insertion anchor', async () => {
      const data = ref(true)
      const { container } = await testHydration(
        `<template>
          <div>
            <span/>
            <components.Child v-if="data"/>
            <span/>
          </div>
        </template>`,
        { Child: `<template>foo</template>` },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span>foo<!--if--><span></span></div>"`,
      )

      data.value = false
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span><!--if--><span></span></div>"`,
      )
    })

    test('consecutive component with insertion parent', async () => {
      const data = reactive({
        show: true,
        foo: 'foo',
        bar: 'bar',
      })
      const { container } = await testHydration(
        `<template>
          <div v-if="data.show">
            <components.Child/>
            <components.Child2/>
          </div>
        </template>`,
        {
          Child: `<template><span>{{data.foo}}</span></template>`,
          Child2: `<template><span>{{data.bar}}</span></template>`,
        },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span>foo</span><span>bar</span></div><!--if-->"`,
      )

      data.show = false
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<!--if-->"`,
      )

      data.show = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span>foo</span><span>bar</span></div><!--if-->"`,
      )

      data.foo = 'foo1'
      data.bar = 'bar1'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span>foo1</span><span>bar1</span></div><!--if-->"`,
      )
    })

    test('on fragment component', async () => {
      const data = ref(true)
      const { container } = await testHydration(
        `<template>
          <div>
            <components.Child v-if="data"/>
          </div>
        </template>`,
        {
          Child: `<template><div>{{ data }}</div>-{{ data }}-</template>`,
        },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><div>true</div>-true-<!--]-->
        <!--if--></div>"
      `,
      )

      data.value = false
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><!--]-->
        <!--if--></div>"
      `,
      )

      data.value = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><!--]-->
        <div>true</div>-true-<!--if--></div>"
      `,
      )
    })

    test('on fragment component with insertion anchor', async () => {
      const data = ref(true)
      const { container } = await testHydration(
        `<template>
          <div>
            <span/>
            <components.Child v-if="data"/>
            <span/>
          </div>
        </template>`,
        {
          Child: `<template><div>{{ data }}</div>-{{ data }}-</template>`,
        },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><div>true</div>-true-<!--]-->
        <!--if--><span></span></div>"
      `,
      )

      data.value = false
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><!--]-->
        <!--if--><span></span></div>"
      `,
      )

      data.value = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
        "<div><span></span>
        <!--[--><!--]-->
        <div>true</div>-true-<!--if--><span></span></div>"
      `)
    })

    test('consecutive v-if on fragment component with insertion anchor', async () => {
      const data = ref(true)
      const { container } = await testHydration(
        `<template>
          <div>
            <span/>
            <components.Child v-if="data"/>
            <components.Child v-if="data"/>
            <span/>
          </div>
        </template>`,
        {
          Child: `<template><div>{{ data }}</div>-{{ data }}-</template>`,
        },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><div>true</div>-true-<!--]-->
        <!--if-->
        <!--[--><div>true</div>-true-<!--]-->
        <!--if--><span></span></div>"
      `,
      )

      data.value = false
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><!--]-->
        <!--if-->
        <!--[--><!--]-->
        <!--if--><span></span></div>"
      `,
      )

      data.value = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
        "<div><span></span>
        <!--[--><!--]-->
        <div>true</div>-true-<!--if-->
        <!--[--><!--]-->
        <div>true</div>-true-<!--if--><span></span></div>"
      `)
    })

    test('on dynamic component with insertion anchor', async () => {
      const data = ref(true)
      const { container } = await testHydration(
        `<template>
          <div>
            <span/>
            <component :is="components.Child" v-if="data"/>
            <span/>
          </div>
        </template>`,
        { Child: `<template>foo</template>` },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span>foo<!--dynamic-component--><!--if--><span></span></div>"`,
      )

      data.value = false
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span><!--if--><span></span></div>"`,
      )

      data.value = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span>foo<!--dynamic-component--><!--if--><span></span></div>"`,
      )
    })

    test('v-if with insertion parent + sibling component', async () => {
      const data = ref(true)
      const { container } = await testHydration(
        `<template>
          <div>
            <span v-if="data">hello</span>
          </div>
          <components.Child/>
        </template>`,
        {
          Child: `<template><div>child</div></template>`,
        },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div><span>hello</span><!--if--></div><div>child</div><!--]-->
        "
      `,
      )

      data.value = false
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div><!--if--></div><div>child</div><!--]-->
        "
      `,
      )

      data.value = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div><span>hello</span><!--if--></div><div>child</div><!--]-->
        "
      `,
      )
    })

    test('v-if with static sibling + root sibling component', async () => {
      const data = ref(true)
      const { container } = await testHydration(
        `<template>
          <div>
            <span v-if="data">hello</span>
            <div>1</div>
          </div>
          <components.Child/>
        </template>`,
        {
          Child: `<template><div>child</div></template>`,
        },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div><span>hello</span><!--if--><div>1</div></div><div>child</div><!--]-->
        "
      `,
      )

      data.value = false
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div><!--if--><div>1</div></div><div>child</div><!--]-->
        "
      `,
      )

      data.value = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div><span>hello</span><!--if--><div>1</div></div><div>child</div><!--]-->
        "
      `,
      )
    })

    test('v-if + static sibling + root sibling component (flat)', async () => {
      const data = ref(true)
      const { container } = await testHydration(
        `<template>
          <span v-if="data">hello</span>
          <span></span>
          <components.Child/>
        </template>`,
        {
          Child: `<template><div>child</div></template>`,
        },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span>hello</span><!--if--><span></span><div>child</div><!--]-->
        "
      `,
      )

      data.value = false
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><!--if--><span></span><div>child</div><!--]-->
        "
      `,
      )

      data.value = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span>hello</span><!--if--><span></span><div>child</div><!--]-->
        "
      `,
      )
    })
  })
})
