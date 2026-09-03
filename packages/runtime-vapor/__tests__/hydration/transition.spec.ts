import { nextTick, reactive, ref } from '@vue/runtime-dom'
import { VueServerRenderer, runtimeDom } from '../_utils'
import {
  compileVaporComponent,
  formatHtml,
  mountWithHydration,
  setupHydrationTest,
  testHydration,
  testWithVDOMApp,
  triggerEvent,
} from './_helpers'

setupHydrationTest()

describe('Vapor Mode hydration', () => {
  describe('transition', async () => {
    test('hydrates a slot fallback without fragment markers', async () => {
      const data = reactive({ show: false })
      const { container } = await testHydration(
        `<template>
          <components.Child>
            <template v-if="data.show">
              <span>content</span>
            </template>
          </components.Child>
        </template>`,
        {
          Child: `<template>
            <Transition :css="false">
              <slot><div>fallback</div></slot>
            </Transition>
          </template>`,
        },
        data,
      )

      expect(`Hydration node mismatch`).toHaveBeenWarned()
      expect(container.textContent).toBe('fallback')

      data.show = true
      await nextTick()
      expect(container.textContent).toBe('content')

      data.show = false
      await nextTick()
      expect(container.textContent).toBe('fallback')
    })

    test('transition appear', async () => {
      const { container } = await testHydration(
        `<template>
          <transition appear>
            <div>foo</div>
          </transition>
        </template>`,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div style="" class="v-enter-from v-enter-active">foo</div>"`,
      )
      expect(`mismatch`).not.toHaveBeenWarned()
    })

    test('transition appear work with pre-existing class', async () => {
      const { container } = await testHydration(
        `<template>
          <transition appear>
            <div class="foo">foo</div>
          </transition>
        </template>`,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div class="foo v-enter-from v-enter-active" style="">foo</div>"`,
      )
      expect(`mismatch`).not.toHaveBeenWarned()
    })

    test('transition appear work with empty content', async () => {
      const data = ref(true)
      const { container } = await testHydration(
        `<template>
          <transition appear>
            <slot v-if="data"></slot>
            <span v-else>foo</span>
          </transition>
        </template>`,
        undefined,
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<!----><!--if-->"`,
      )
      expect(`mismatch`).not.toHaveBeenWarned()

      data.value = false
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<span class="v-enter-from v-enter-active">foo</span><!--if-->"`,
      )
    })

    test('transition appear with v-if', async () => {
      const data = ref(false)
      const { container } = await testHydration(
        `<template>
          <transition appear>
            <div v-if="data">foo</div>
          </transition>
        </template>`,
        undefined,
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`"<!---->"`)
      expect(`mismatch`).not.toHaveBeenWarned()
    })

    test('transition appear with v-show', async () => {
      const data = ref(false)
      const { container } = await testHydration(
        `<template>
          <transition appear>
            <div v-show="data">foo</div>
          </transition>
        </template>`,
        undefined,
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div style="display:none;" class="v-enter-from v-enter-active">foo</div>"`,
      )
      expect(`mismatch`).not.toHaveBeenWarned()
    })

    test('transition appear with slotted v-show', async () => {
      const data = ref(false)
      const { container } = await testHydration(
        `<template>
          <transition appear>
            <components.Child>
              <div v-show="data">foo</div>
            </components.Child>
          </transition>
        </template>`,
        {
          Child: `<template><slot /></template>`,
        },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
      	"
      	<!--[--><div style="display:none;" class="v-enter-from v-enter-active">foo</div><!--]-->
      	"
      `,
      )
      expect(`mismatch`).not.toHaveBeenWarned()
    })

    test('transition appear with forwarded slotted v-show', async () => {
      const data = ref(false)
      const { container } = await testHydration(
        `<template>
          <transition appear>
            <components.Parent>
              <div v-show="data">foo</div>
            </components.Parent>
          </transition>
        </template>`,
        {
          Parent: `<template><components.Child><slot /></components.Child></template>`,
          Child: `<template><slot /></template>`,
        },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
      	"
      	<!--[-->
      	<!--[--><div style="display:none;" class="v-enter-from v-enter-active">foo</div><!--]-->
      	<!--]-->
      	"
      `,
      )
      expect(`mismatch`).not.toHaveBeenWarned()
    })

    test('transition appear w/ event listener', async () => {
      const { container } = await testHydration(
        `<script setup>
          import { ref } from 'vue'
          const count = ref(0)
        </script>
        <template>
          <transition appear>
            <button @click="count++">{{ count }}</button>
          </transition>
        </template>`,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<button style="" class="v-enter-from v-enter-active">0</button>"`,
      )

      triggerEvent('click', container.querySelector('button')!)
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<button style="" class="v-enter-from v-enter-active">1</button>"`,
      )
    })

    test('transition should hydrate empty v-if placeholder without fragment markers', async () => {
      const data = ref(false)
      const { container } = await testHydration(
        `<template>
          <Transition :css="false">
            <div v-if="data">foo</div>
          </Transition>
        </template>`,
        undefined,
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`"<!---->"`)
      expect(`mismatch`).not.toHaveBeenWarned()

      data.value = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div>foo</div><!---->"`,
      )

      data.value = false
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`"<!---->"`)
    })

    test('transition appear should not break following component hydration', async () => {
      const data = ref('initial')
      const { container, html } = await testHydration(
        `<template>
          <div>
            <Transition :css="false" appear>
              <p>{{ data }}</p>
            </Transition>
            <components.Second />
          </div>
        </template>`,
        {
          Second: `<template><i>{{ data }}</i></template>`,
        },
        data,
      )

      expect(html).toBe(
        '<div><template><p>initial</p></template><i>initial</i></div>',
      )
      expect(container.innerHTML).toBe(
        '<div><p style="">initial</p><i>initial</i></div>',
      )

      data.value = 'updated'
      await nextTick()
      expect(container.innerHTML).toBe(
        '<div><p style="">updated</p><i>updated</i></div>',
      )
    })
  })

  describe('transition-group', () => {
    test('with tag should hydrate existing container for flattened v-for children', async () => {
      const data = ref({
        items: [1],
      })
      const code = `
        <TransitionGroup name="list" tag="ul" style="margin-top:20px;">
          <li v-for="item in data.items" :key="item">
            {{ item }}
          </li>
        </TransitionGroup>
      `
      const SSRComp = compileVaporComponent(code, data, undefined, true)
      const html = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRComp),
      )

      const { container } = await mountWithHydration(html, code, data)
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<ul name="list" style="margin-top:20px;"><li>1</li><!--for--></ul><!--transition-group-->"`,
      )
      data.value.items.push(2)
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<ul name="list" style="margin-top:20px;"><li>1</li><li class="list-enter-from list-enter-active">2</li><!--for--></ul><!--transition-group-->"`,
      )

      data.value.items.shift()
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<ul name="list" style="margin-top:20px;"><li class="list-leave-from list-leave-active">1</li><li class="list-enter-from list-enter-active">2</li><!--for--></ul><!--transition-group-->"`,
      )
      expect(
        `Hydration completed but contains mismatches.`,
      ).not.toHaveBeenWarned()
    })

    test('with tag should keep nested v-for anchor inside container', async () => {
      const data = reactive({
        items: [1, 2, 3, 4, 5],
      })
      const { container } = await testWithVDOMApp(
        `<template><components.Child /></template>`,
        {
          Child: {
            code: `
              <template>
                <div class="demo">
                  <TransitionGroup name="list" tag="ul" style="margin-top:20px;">
                    <li v-for="item in data.items" :key="item">{{ item }}</li>
                  </TransitionGroup>
                </div>
              </template>
            `,
            vapor: true,
          },
        },
        data,
      )
      const ul = container.querySelector('ul')!

      data.items.splice(2, 0, 6)
      await nextTick()
      expect(formatHtml(ul.innerHTML)).toMatchInlineSnapshot(
        `"<li>1</li><li>2</li><li class="list-enter-from list-enter-active">6</li><li>3</li><li>4</li><li>5</li><!--for-->"`,
      )
      expect(
        `Hydration completed but contains mismatches.`,
      ).not.toHaveBeenWarned()
    })

    test('with tag should remove stale SSR v-for children when client list is shorter', async () => {
      const ssrData = ref({
        items: [1, 2, 3],
      })
      const data = ref({
        items: [1],
      })
      const code = `
        <TransitionGroup :css="false" tag="ul">
          <li v-for="item in data.items" :key="item">{{ item }}</li>
        </TransitionGroup>
      `
      const SSRComp = compileVaporComponent(code, ssrData, undefined, true)
      const html = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRComp),
      )
      const { container } = await mountWithHydration(html, code, data)
      const ul = container.querySelector('ul')!

      expect(formatHtml(ul.innerHTML)).toMatchInlineSnapshot(
        `"<li>1</li><!--for-->"`,
      )
      expect(`Hydration children mismatch`).toHaveBeenWarned()

      data.value.items.push(4)
      await nextTick()
      expect(formatHtml(ul.innerHTML)).toMatchInlineSnapshot(
        `"<li>1</li><li>4</li><!--for-->"`,
      )
    })

    test('with tag should preserve trailing sibling when removing stale SSR v-for children', async () => {
      const ssrData = ref({
        items: [1, 2, 3],
        tail: 'tail',
      })
      const data = ref({
        items: [1],
        tail: 'tail',
      })
      const code = `
        <TransitionGroup :css="false" tag="ul">
          <li v-for="item in data.items" :key="item" class="item">{{ item }}</li>
          <li key="tail" class="tail">{{ data.tail }}</li>
        </TransitionGroup>
      `
      const SSRComp = compileVaporComponent(code, ssrData, undefined, true)
      const html = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRComp),
      )
      const { container } = await mountWithHydration(html, code, data)
      const ul = container.querySelector('ul')!

      expect(formatHtml(ul.innerHTML)).toMatchInlineSnapshot(
        `"<li class="item">1</li><!--for--><li class="item">tail</li>"`,
      )
      expect(`Hydration text mismatch`).toHaveBeenWarned()
      expect(`Hydration children mismatch`).toHaveBeenWarned()

      data.value.items.push(4)
      data.value.tail = 'tail updated'
      await nextTick()
      expect(formatHtml(ul.innerHTML)).toMatchInlineSnapshot(
        `"<li class="item">1</li><li class="item">4</li><!--for--><li class="item">tail updated</li>"`,
      )
    })

    test('with tag should keep v-for anchor before replaced trailing sibling', async () => {
      const ssrData = ref({
        items: [1, 2, 3],
        tail: 'tail',
      })
      const data = ref({
        items: [1],
        tail: 'tail',
      })
      const code = `
        <TransitionGroup :css="false" tag="div">
          <span v-for="item in data.items" :key="item">{{ item }}</span>
          <p key="tail">{{ data.tail }}</p>
        </TransitionGroup>
      `
      const SSRComp = compileVaporComponent(code, ssrData, undefined, true)
      const html = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRComp),
      )
      const { container } = await mountWithHydration(html, code, data)
      const div = container.querySelector('div')!

      expect(formatHtml(div.innerHTML)).toMatchInlineSnapshot(
        `"<span>1</span><!--for--><p>tail</p>"`,
      )
      expect(`Hydration node mismatch`).toHaveBeenWarned()
      expect(`Hydration text mismatch`).not.toHaveBeenWarned()
      expect(`Hydration children mismatch`).toHaveBeenWarned()

      data.value.items.push(4)
      data.value.tail = 'tail updated'
      await nextTick()
      expect(formatHtml(div.innerHTML)).toMatchInlineSnapshot(
        `"<span>1</span><span>4</span><!--for--><p>tail updated</p>"`,
      )
    })

    test('with tag should place v-for anchor before trailing sibling without SSR close marker', async () => {
      const data = ref({
        items: [1, 2],
        tail: 'tail',
      })
      const code = `
        <TransitionGroup :css="false" tag="ul">
          <li v-for="item in data.items" :key="item">{{ item }}</li>
          <li key="tail">{{ data.tail }}</li>
        </TransitionGroup>
      `
      const SSRComp = compileVaporComponent(code, data, undefined, true)
      const html = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRComp),
      )
      const { container } = await mountWithHydration(html, code, data)
      const ul = container.querySelector('ul')!
      data.value.items.push(3)
      data.value.tail = 'tail updated'
      await nextTick()
      expect(formatHtml(ul.innerHTML)).toMatchInlineSnapshot(
        `"<li>1</li><li>2</li><li>3</li><!--for--><li>tail updated</li>"`,
      )

      data.value.items.shift()
      await nextTick()
      expect(formatHtml(ul.innerHTML)).toMatchInlineSnapshot(
        `"<li>2</li><li>3</li><!--for--><li>tail updated</li>"`,
      )
      expect(
        `Hydration completed but contains mismatches.`,
      ).not.toHaveBeenWarned()
    })

    test('with tag should reuse the close marker kept by slot content', async () => {
      // SSR only strips the slot fragment markers when the slot renders a
      // single fragment; with a trailing sibling the v-for keeps its own
      const data = ref({
        items: [1, 2],
        tail: 'tail',
      })
      const { container } = await testHydration(
        `<template>
          <components.Child>
            <li v-for="item in data.items" :key="item">{{ item }}</li>
            <li key="tail">{{ data.tail }}</li>
          </components.Child>
        </template>`,
        {
          Child: `<template>
            <TransitionGroup :css="false" tag="ul"><slot /></TransitionGroup>
          </template>`,
        },
        data,
      )
      const ul = container.querySelector('ul')!
      // the SSR close marker is the list anchor; no extra `<!--for-->`
      expect(ul.innerHTML).toBe(
        `<!--[--><li>1</li><li>2</li><!--]--><!--slot--><li>tail</li>`,
      )
      data.value.items.push(3)
      data.value.tail = 'tail updated'
      await nextTick()
      expect(ul.innerHTML).toBe(
        `<!--[--><li>1</li><li>2</li><li>3</li><!--]--><!--slot--><li>tail updated</li>`,
      )
      expect(
        `Hydration completed but contains mismatches.`,
      ).not.toHaveBeenWarned()
    })

    // #15372
    test('should drop comment children to stay in sync with SSR output', async () => {
      const data = ref({
        items: ['a', 'b', 'c'],
      })
      const code = `
        <TransitionGroup :css="false" tag="ul">
          <!-- comment -->
          <li v-for="item in data.items" :key="item">{{ item }}</li>
        </TransitionGroup>
      `
      const SSRComp = compileVaporComponent(code, data, undefined, true)
      const html = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRComp),
      )
      // SSR deliberately omits comment children of TransitionGroup (#11961)
      expect(html).not.toContain('comment')

      const { container } = await mountWithHydration(html, code, data)
      const ul = container.querySelector('ul')!

      expect(formatHtml(ul.innerHTML)).toMatchInlineSnapshot(
        `"<li>a</li><li>b</li><li>c</li><!--for-->"`,
      )
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()
      expect(
        `Hydration completed but contains mismatches.`,
      ).not.toHaveBeenWarned()

      data.value.items.push('d')
      await nextTick()
      expect(formatHtml(ul.innerHTML)).toMatchInlineSnapshot(
        `"<li>a</li><li>b</li><li>c</li><li>d</li><!--for-->"`,
      )
    })

    test('with tag should hydrate empty claimed container for flattened v-for children', async () => {
      const data = ref({
        items: [] as number[],
      })
      const code = `
        <TransitionGroup :css="false" tag="ul">
          <li v-for="item in data.items" :key="item">{{ item }}</li>
        </TransitionGroup>
      `
      const SSRComp = compileVaporComponent(code, data, undefined, true)
      const html = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRComp),
      )
      const { container } = await mountWithHydration(html, code, data)
      const ul = container.querySelector('ul')!

      expect(formatHtml(ul.innerHTML)).toMatchInlineSnapshot(`"<!--for-->"`)

      data.value.items.push(1, 2)
      await nextTick()
      expect(formatHtml(ul.innerHTML)).toMatchInlineSnapshot(
        `"<li>1</li><li>2</li><!--for-->"`,
      )

      data.value.items.shift()
      await nextTick()
      expect(formatHtml(ul.innerHTML)).toMatchInlineSnapshot(
        `"<li>2</li><!--for-->"`,
      )
      expect(
        `Hydration completed but contains mismatches.`,
      ).not.toHaveBeenWarned()
    })

    test('with tag should place empty v-for anchor before trailing sibling', async () => {
      const data = ref({
        items: [] as number[],
        tail: 'tail',
      })
      const code = `
        <TransitionGroup :css="false" tag="ul">
          <li v-for="item in data.items" :key="item">{{ item }}</li>
          <li key="tail">{{ data.tail }}</li>
        </TransitionGroup>
      `
      const SSRComp = compileVaporComponent(code, data, undefined, true)
      const html = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRComp),
      )
      const { container } = await mountWithHydration(html, code, data)
      const ul = container.querySelector('ul')!

      expect(formatHtml(ul.innerHTML)).toMatchInlineSnapshot(
        `"<!--for--><li>tail</li>"`,
      )

      data.value.items.push(1)
      data.value.tail = 'tail updated'
      await nextTick()
      expect(formatHtml(ul.innerHTML)).toMatchInlineSnapshot(
        `"<li>1</li><!--for--><li>tail updated</li>"`,
      )

      data.value.items.shift()
      await nextTick()
      expect(formatHtml(ul.innerHTML)).toMatchInlineSnapshot(
        `"<!--for--><li>tail updated</li>"`,
      )
      expect(
        `Hydration completed but contains mismatches.`,
      ).not.toHaveBeenWarned()
    })

    test('with tag should keep empty v-for anchor inside container when wrapped by parent fragment boundary', async () => {
      const data = ref({
        items: [] as number[],
        after: 'after',
      })
      const code = `
        <div>
          <template v-if="true">
            <TransitionGroup :css="false" tag="ul">
              <li v-for="item in data.items" :key="item">{{ item }}</li>
            </TransitionGroup>
            <span>{{ data.after }}</span>
          </template>
        </div>
      `
      const SSRComp = compileVaporComponent(code, data, undefined, true)
      const html = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRComp),
      )
      const { container } = await mountWithHydration(html, code, data)
      const ul = container.querySelector('ul')!

      expect(formatHtml(ul.innerHTML)).toMatchInlineSnapshot(`"<!--for-->"`)
      expect(formatHtml(container.innerHTML)).toContain('<span>after</span>')

      data.value.items.push(1)
      data.value.after = 'after updated'
      await nextTick()
      expect(formatHtml(ul.innerHTML)).toMatchInlineSnapshot(
        `"<li>1</li><!--for-->"`,
      )
      expect(formatHtml(container.innerHTML)).toContain(
        '<span>after updated</span>',
      )
      expect(
        `Hydration completed but contains mismatches.`,
      ).not.toHaveBeenWarned()
    })

    test('with tag should prefer local anchor over slot fallback boundary', async () => {
      const data = reactive({
        items: [] as number[],
        tail: 'tail',
        after: 'after',
      })
      const { container } = await testHydration(
        `<template><components.Child /></template>`,
        {
          Child: `<template>
            <slot>
              <TransitionGroup :css="false" tag="ul">
                <li v-for="item in data.items" :key="item">{{ item }}</li>
                <li key="tail">{{ data.tail }}</li>
              </TransitionGroup>
              <i>{{ data.after }}</i>
            </slot>
          </template>`,
        },
        data,
      )
      const ul = container.querySelector('ul')!

      expect(formatHtml(ul.innerHTML)).toMatchInlineSnapshot(
        `"<!--for--><li>tail</li>"`,
      )
      expect(formatHtml(container.innerHTML)).toContain('<i>after</i>')

      data.items.push(1)
      data.after = 'after updated'
      await nextTick()
      expect(formatHtml(ul.innerHTML)).toMatchInlineSnapshot(
        `"<li>1</li><!--for--><li>tail</li>"`,
      )
      expect(formatHtml(container.innerHTML)).toContain('<i>after updated</i>')
      expect(
        `Hydration completed but contains mismatches.`,
      ).not.toHaveBeenWarned()
    })
  })
})
