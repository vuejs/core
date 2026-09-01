import { nextTick, reactive } from '@vue/runtime-dom'
import {
  formatHtml,
  setupHydrationTest,
  testHydration,
  testWithVDOMApp,
} from './_helpers'

setupHydrationTest()

describe('Vapor Mode hydration', () => {
  describe('slots', () => {
    test('forwarded slot', async () => {
      const data = reactive({
        foo: 'foo',
        bar: 'bar',
      })
      const { container } = await testHydration(
        `<template>
          <div>
            <components.Parent>
              <span>{{data.foo}}</span>
            </components.Parent>
            <div>{{data.bar}}</div>
          </div>
        </template>`,
        {
          Parent: `<template><div><components.Child><slot/></components.Child></div></template>`,
          Child: `<template><div><slot/></div></template>`,
        },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
      	"<div><div><div>
      	<!--[-->
      	<!--[--><span>foo</span><!--]-->
      	<!--]-->
      	</div></div><div>bar</div></div>"
      `,
      )

      data.foo = 'foo1'
      data.bar = 'bar1'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
      	"<div><div><div>
      	<!--[-->
      	<!--[--><span>foo1</span><!--]-->
      	<!--]-->
      	</div></div><div>bar1</div></div>"
      `,
      )
    })

    test('forwarded slot with fallback but rendered content', async () => {
      const data = reactive({ foo: 'foo' })
      const { container } = await testHydration(
        `<template>
          <components.Parent><span>{{data.foo}}</span></components.Parent>
        </template>`,
        {
          Parent: `<template><components.Child><slot/></components.Child></template>`,
          Child: `<template><div><slot>bar</slot></div></template>`,
        },
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      	"<div>
      	<!--[-->
      	<!--[--><span>foo</span><!--]-->
      	<!--]-->
      	</div>"
      `)

      data.foo = 'foo1'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      	"<div>
      	<!--[-->
      	<!--[--><span>foo1</span><!--]-->
      	<!--]-->
      	</div>"
      `)
    })

    test('forwarded slot with fallback', async () => {
      const data = reactive({
        foo: 'foo',
      })
      const { container } = await testHydration(
        `<template>
          <components.Parent/>
        </template>`,
        {
          Parent: `<template><components.Child><slot/></components.Child></template>`,
          Child: `<template><div><slot>{{data.foo}}</slot></div></template>`,
        },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[-->foo<!--slot--><!--]-->
        </div>"
      `,
      )

      data.foo = 'foo1'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[-->foo1<!--slot--><!--]-->
        </div>"
      `,
      )
    })

    test.each([
      ['direct', `<slot />`],
      ['v-if', `<slot v-if="true" />`],
      ['v-for', `<slot v-for="n in [1]" :key="n" />`],
    ])(
      'forwarded %s root slot replaces receiver fallback when content becomes valid',
      async (_, outlet) => {
        const data = reactive({ show: false })
        const { container } = await testHydration(
          `<script setup>
          const components = _components
          const data = _data
        </script>
        <template>
          <components.Carrier>
            <span v-if="data.show">content</span>
          </components.Carrier>
        </template>`,
          {
            Receiver: `<template><slot><span>fallback</span></slot></template>`,
            Carrier: `<script setup>const components = _components</script>
            <template>
              <components.Receiver>${outlet}</components.Receiver>
            </template>`,
          },
          data,
        )

        expect(container.textContent).toBe('fallback')
        expect(`Hydration node mismatch`).not.toHaveBeenWarned()

        data.show = true
        await nextTick()

        expect(container.textContent).toBe('content')
      },
    )

    test('forwarded keyed root slot tracks fallback across hydration and key updates', async () => {
      const data = reactive({ show: false, key: 0 })
      const { container } = await testHydration(
        `<script setup>
        const components = _components
        const data = _data
      </script>
      <template>
        <components.Carrier>
          <span v-if="data.show">content</span>
        </components.Carrier>
      </template>`,
        {
          Receiver: `<template><slot><span>fallback</span></slot></template>`,
          Carrier: `<script setup>
          const components = _components
          const data = _data
        </script>
        <template>
          <components.Receiver>
            <slot :key="data.key" />
          </components.Receiver>
        </template>`,
        },
        data,
      )

      expect(container.textContent).toBe('fallback')
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()

      data.show = true
      await nextTick()
      expect(container.textContent).toBe('content')

      data.key++
      data.show = false
      await nextTick()
      expect(container.textContent).toBe('fallback')

      data.show = true
      await nextTick()
      expect(container.textContent).toBe('content')
    })

    test('keyed dynamic slot root tracks fallback when remounted validity changes', async () => {
      let view: string | null = 'span'
      const data = reactive({
        key: 0,
        getView: () => view,
      })
      const { container } = await testHydration(
        `<script setup>
        const components = _components
        const data = _data
      </script>
      <template>
        <components.Receiver>
          <component :is="data.getView()" :key="data.key">content</component>
        </components.Receiver>
      </template>`,
        {
          Receiver: `<template><slot><span>fallback</span></slot></template>`,
        },
        data,
      )

      expect(container.textContent).toBe('content')

      view = null
      data.key++
      await nextTick()
      expect(container.textContent).toBe('fallback')
      expect(container.innerHTML).not.toContain('keyed')

      view = 'span'
      data.key++
      await nextTick()
      expect(container.textContent).toBe('content')
    })

    test.each([
      {
        initial: { showA: true, showB: false },
        initialText: 'A',
      },
      {
        initial: { showA: false, showB: false },
        initialText: 'fallback',
      },
      {
        initial: { showA: false, showB: true },
        initialText: 'B',
      },
    ])(
      'multiple forwarded roots resolve receiver fallback once from $initialText',
      async ({ initial, initialText }) => {
        const data = reactive({ ...initial })
        const { container } = await testHydration(
          `<script setup>
        const components = _components
        const data = _data
      </script>
      <template>
        <components.Carrier>
          <template #a><span v-if="data.showA">A</span></template>
          <template #b><span v-if="data.showB">B</span></template>
        </components.Carrier>
      </template>`,
          {
            Receiver: `<template><slot><span>fallback</span></slot></template>`,
            Carrier: `<script setup>const components = _components</script>
          <template>
            <components.Receiver>
              <slot name="a" />
              <slot name="b" />
            </components.Receiver>
          </template>`,
          },
          data,
        )
        expect(container.textContent).toBe(initialText)
        expect(`Hydration children mismatch`).not.toHaveBeenWarned()

        if (initialText === 'A') {
          data.showB = true
        } else if (initialText === 'B') {
          data.showA = true
        }
        if (initialText !== 'fallback') {
          await nextTick()
          expect(container.textContent).toBe('AB')
        }

        data.showA = false
        data.showB = false
        await nextTick()
        expect(container.textContent).toBe('fallback')

        data.showB = true
        await nextTick()
        expect(container.textContent).toBe('B')

        data.showA = true
        await nextTick()
        expect(container.textContent).toBe('AB')

        data.showA = false
        data.showB = false
        await nextTick()
        expect(container.textContent).toBe('fallback')
      },
    )

    test('multiple invalid forwarded roots hydrate fragment fallback without child anchors', async () => {
      const data = reactive({ showA: false, showB: false, fallback: true })
      const { container } = await testHydration(
        `<script setup>
        const components = _components
        const data = _data
      </script>
      <template>
        <components.Carrier>
          <template #a><span v-if="data.showA">A</span></template>
          <template #b><span v-if="data.showB">B</span></template>
        </components.Carrier>
      </template>`,
        {
          Receiver: `<script setup>const data = _data</script>
          <template>
            <slot>
              <template v-if="data.fallback">
                <span>fallback 1</span><span>fallback 2</span>
              </template>
            </slot>
          </template>`,
          Carrier: `<script setup>const components = _components</script>
          <template>
            <components.Receiver>
              <slot name="a" />
              <slot name="b" />
            </components.Receiver>
          </template>`,
        },
        data,
      )

      expect(container.textContent).toBe('fallback 1fallback 2')
      expect(container.innerHTML).not.toContain('<!--slot-->')
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()
    })

    test('nested forwarded slot hydrates its own range inside stable content', async () => {
      const data = reactive({ branch: true, show: false })
      const { container } = await testHydration(
        `<script setup>const components = _components; const data = _data</script>
        <template>
          <components.Carrier>
            <span v-if="data.show">content</span>
          </components.Carrier>
        </template>`,
        {
          Receiver: `<template><slot><b>receiver fallback</b></slot></template>`,
          Carrier: `<script setup>const components = _components; const data = _data</script>
          <template>
            <components.Receiver>
              <template v-if="data.branch"><div><slot /></div></template>
            </components.Receiver>
          </template>`,
        },
        data,
      )

      expect(container.querySelector('div')!.textContent).toBe('')

      data.show = true
      await nextTick()
      expect(container.querySelector('div')!.textContent).toBe('content')

      data.branch = false
      await nextTick()
      expect(container.textContent).toBe('receiver fallback')
      // The receiver outlet claims its own SSR close marker as anchor
      // instead of allocating a runtime <!--slot--> comment.
      expect(container.innerHTML.match(/<!--slot-->/g)).toBeNull()

      data.branch = true
      await nextTick()
      expect(container.querySelector('div')!.textContent).toBe('content')

      data.show = false
      await nextTick()
      expect(container.querySelector('div')!.textContent).toBe('')

      data.branch = false
      await nextTick()
      expect(container.textContent).toBe('receiver fallback')
    })

    test('nested fallbacks stay within a shared boundary during hydration', async () => {
      const data = reactive({ showX: false })
      const { container } = await testHydration(
        `<script setup>const components = _components; const data = _data</script>
        <template>
          <components.Carrier>
            <template #x><span v-if="data.showX">X</span></template>
          </components.Carrier>
        </template>`,
        {
          Receiver: `<template><slot><span>receiver fallback</span></slot></template>`,
          Carrier: `<script setup>const components = _components</script>
          <template>
            <components.Receiver>
              <slot name="a"><slot name="x" /></slot>
              <slot name="b"><slot name="y" /></slot>
            </components.Receiver>
          </template>`,
        },
        data,
      )

      expect(container.textContent).toBe('receiver fallback')
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()

      data.showX = true
      await nextTick()
      expect(container.textContent).toBe('X')

      data.showX = false
      await nextTick()
      expect(container.textContent).toBe('receiver fallback')
    })

    test('v-once forwarded root shares fallback during hydration', async () => {
      const data = reactive({ showB: false })
      const { container } = await testHydration(
        `<script setup>
        const components = _components
        const data = _data
      </script>
      <template>
        <components.Carrier>
          <template #a><span v-if="false">A</span></template>
          <template #b><span v-if="data.showB">B</span></template>
        </components.Carrier>
      </template>`,
        {
          Receiver: `<template><slot><span>fallback</span></slot></template>`,
          Carrier: `<script setup>const components = _components</script>
          <template>
            <components.Receiver>
              <slot v-once name="a" />
              <slot name="b" />
            </components.Receiver>
          </template>`,
        },
        data,
      )

      expect(container.textContent).toBe('fallback')

      data.showB = true
      await nextTick()
      expect(container.textContent).toBe('B')
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()
    })

    test('shared local fallback participates in aggregate hydration', async () => {
      const data = reactive({ localA: false })
      const { container } = await testHydration(
        `<script setup>const components = _components</script>
        <template><components.Carrier /></template>`,
        {
          Receiver: `<template><slot><b>receiver 1</b><b>receiver 2</b></slot></template>`,
          Carrier: `<script setup>const components = _components; const data = _data</script>
          <template>
            <components.Receiver>
              <slot name="a"><span v-if="data.localA">local A</span></slot>
              <slot name="b" />
            </components.Receiver>
          </template>`,
        },
        data,
      )

      expect(container.textContent).toBe('receiver 1receiver 2')
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()

      data.localA = true
      await nextTick()
      expect(container.textContent).toBe('local A')
    })

    test('v-for restores slot boundary for roots created after hydration', async () => {
      const data = reactive({ items: [] as number[], show: false })
      const { container } = await testHydration(
        `<script setup>const components = _components; const data = _data</script>
        <template>
          <components.Carrier>
            <span v-if="data.show">content</span>
          </components.Carrier>
        </template>`,
        {
          Receiver: `<template><slot><b>receiver fallback</b></slot></template>`,
          Carrier: `<script setup>const components = _components; const data = _data</script>
          <template>
            <components.Receiver>
              <slot v-for="item in data.items" :key="item" />
            </components.Receiver>
          </template>`,
        },
        data,
      )

      expect(container.textContent).toBe('receiver fallback')

      data.items.push(1)
      await nextTick()
      expect(container.textContent).toBe('receiver fallback')

      data.show = true
      await nextTick()
      expect(container.textContent).toBe('content')
    })

    test('slot-root v-for keeps its hydration anchor for empty component items', async () => {
      const data = reactive({ items: [1], show: false })
      const { container } = await testHydration(
        `<script setup>const components = _components</script>
        <template><components.Carrier /></template>`,
        {
          Receiver: `<template><slot><b>receiver fallback</b></slot></template>`,
          EmptyItem: `<script setup>const data = _data</script>
          <template><span v-if="data.show">item</span></template>`,
          Carrier: `<script setup>const components = _components; const data = _data</script>
          <template>
            <components.Receiver>
              <components.EmptyItem
                v-for="item in data.items"
                :key="item"
              />
            </components.Receiver>
          </template>`,
        },
        data,
      )

      expect(container.textContent).toBe('')
      expect(container.textContent).not.toContain('receiver fallback')

      data.items.push(2)
      await nextTick()
      data.show = true
      await nextTick()
      expect(container.textContent).toBe('itemitem')
    })

    test('vdom shared roots preserve hydration order and receiver fallback', async () => {
      const data = reactive({ showA: false, showB: true })
      const { container } = await testWithVDOMApp(
        `<script setup>const components = _components; const data = _data</script>
        <template>
          <components.Carrier>
            <template #a><span v-if="data.showA">A</span></template>
            <template #b><span v-if="data.showB">B</span></template>
          </components.Carrier>
        </template>`,
        {
          Receiver: `<template><slot><b>receiver fallback</b></slot></template>`,
          Carrier: `<script setup>const components = _components</script>
          <template>
            <components.Receiver>
              <slot name="a" />
              <slot name="b" />
            </components.Receiver>
          </template>`,
        },
        data,
      )

      expect(container.textContent).toBe('B')
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()

      data.showA = true
      await nextTick()
      expect(container.textContent).toBe('AB')

      data.showA = false
      data.showB = false
      await nextTick()
      expect(container.textContent).toBe('receiver fallback')

      data.showB = true
      await nextTick()
      expect(container.textContent).toBe('B')
    })

    // The deferred shared fallback parks content in a detached
    // DocumentFragment during hydration, so the slot's namespace has to come
    // from the SSR container captured before rendering, not from
    // `currentParentNode`.
    test('shared roots parked during hydration keep the svg namespace', async () => {
      const data = reactive({ showA: false, showB: false })
      const { container } = await testWithVDOMApp(
        `<script setup>const components = _components; const data = _data</script>
        <template>
          <components.Carrier>
            <template #a><circle v-if="data.showA" /></template>
            <template #b><rect v-if="data.showB" /></template>
          </components.Carrier>
        </template>`,
        {
          Receiver: `<template><svg><slot><text>fb</text></slot></svg></template>`,
          Carrier: `<script setup>const components = _components</script>
          <template>
            <components.Receiver>
              <slot name="a" />
              <slot name="b" />
            </components.Receiver>
          </template>`,
        },
        data,
      )
      expect(container.textContent).toBe('fb')
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()

      data.showA = true
      await nextTick()
      expect(container.querySelector('circle')!.namespaceURI).toBe(
        'http://www.w3.org/2000/svg',
      )

      data.showB = true
      await nextTick()
      expect(container.querySelector('rect')!.namespaceURI).toBe(
        'http://www.w3.org/2000/svg',
      )
    })

    test('vdom shared roots hydrate from receiver fallback', async () => {
      const data = reactive({ mount: true, showA: false, showB: false })
      const { app, container } = await testWithVDOMApp(
        `<script setup>const components = _components; const data = _data</script>
        <template>
          <components.Carrier v-if="data.mount">
            <template #a><span v-if="data.showA">A</span></template>
            <template #b><span v-if="data.showB">B</span></template>
          </components.Carrier>
        </template>`,
        {
          Receiver: `<template><slot><b>receiver fallback</b></slot></template>`,
          Carrier: `<script setup>const components = _components</script>
          <template>
            <components.Receiver>
              <slot name="a" />
              <slot name="b" />
            </components.Receiver>
          </template>`,
        },
        data,
      )

      expect(container.textContent).toBe('receiver fallback')
      const fallbackNodeCount = container.childNodes.length
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()

      data.showB = true
      await nextTick()
      expect(container.textContent).toBe('B')

      data.showA = true
      await nextTick()
      expect(container.textContent).toBe('AB')

      data.showA = false
      data.showB = false
      await nextTick()
      expect(container.textContent).toBe('receiver fallback')
      expect(container.childNodes).toHaveLength(fallbackNodeCount)

      data.mount = false
      await nextTick()
      expect(container.textContent).toBe('')
      app.unmount()
    })

    test('vdom shared roots leave fragment receiver fallback to the parent', async () => {
      const data = reactive({ showA: false, showB: false })
      const { container } = await testWithVDOMApp(
        `<script setup>const components = _components; const data = _data</script>
        <template>
          <components.Carrier>
            <template #a><span v-if="data.showA">A</span></template>
            <template #b><span v-if="data.showB">B</span></template>
          </components.Carrier>
        </template>`,
        {
          Receiver: `<template>
            <slot>
              <template v-if="true">
                <b>receiver 1</b><b>receiver 2</b>
              </template>
            </slot>
          </template>`,
          Carrier: `<script setup>const components = _components</script>
          <template>
            <components.Receiver>
              <slot name="a" />
              <slot name="b" />
            </components.Receiver>
          </template>`,
        },
        data,
      )

      expect(container.textContent).toBe('receiver 1receiver 2')
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()

      data.showB = true
      await nextTick()
      expect(container.textContent).toBe('B')
    })

    test('vdom shared local fallback participates in aggregate hydration', async () => {
      const data = reactive({ localA: false, showB: false })
      const { container } = await testWithVDOMApp(
        `<script setup>const components = _components; const data = _data</script>
        <template>
          <components.Carrier>
            <template #b><span v-if="data.showB">B</span></template>
          </components.Carrier>
        </template>`,
        {
          Receiver: `<template><slot><b>receiver fallback</b></slot></template>`,
          Carrier: `<script setup>const components = _components; const data = _data</script>
          <template>
            <components.Receiver>
              <slot name="a"><span v-if="data.localA">local A</span></slot>
              <slot name="b" />
            </components.Receiver>
          </template>`,
        },
        data,
      )

      expect(container.textContent).toBe('receiver fallback')
      const fallbackNodeCount = container.childNodes.length
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()

      data.localA = true
      await nextTick()
      expect(container.textContent).toBe('local A')

      data.localA = false
      await nextTick()
      expect(container.textContent).toBe('receiver fallback')
      expect(container.childNodes).toHaveLength(fallbackNodeCount)

      data.showB = true
      await nextTick()
      expect(container.textContent).toBe('B')

      data.showB = false
      await nextTick()
      expect(container.textContent).toBe('receiver fallback')
      expect(container.childNodes).toHaveLength(fallbackNodeCount)

      data.localA = true
      await nextTick()
      expect(container.textContent).toBe('local A')
    })

    test('vdom shared local fallback does not claim fragment receiver fallback', async () => {
      const data = reactive({ localA: false })
      const { container } = await testWithVDOMApp(
        `<script setup>const components = _components</script>
        <template><components.Carrier /></template>`,
        {
          Receiver: `<template>
            <slot>
              <template v-if="true">
                <b>receiver 1</b><b>receiver 2</b>
              </template>
            </slot>
          </template>`,
          Carrier: `<script setup>const components = _components; const data = _data</script>
          <template>
            <components.Receiver>
              <slot name="a"><span v-if="data.localA">local A</span></slot>
              <slot name="b" />
            </components.Receiver>
          </template>`,
        },
        data,
      )

      expect(container.textContent).toBe('receiver 1receiver 2')
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()

      data.localA = true
      await nextTick()
      expect(container.textContent).toBe('local A')

      data.localA = false
      await nextTick()
      expect(container.textContent).toBe('receiver 1receiver 2')
    })

    test('vdom shared local fallback preserves sibling hydration order', async () => {
      const data = reactive({ localA: false, showB: true })
      const { container } = await testWithVDOMApp(
        `<script setup>const components = _components; const data = _data</script>
        <template>
          <components.Carrier>
            <template #b><span v-if="data.showB">B</span></template>
          </components.Carrier>
        </template>`,
        {
          Receiver: `<template><slot><b>receiver fallback</b></slot></template>`,
          Carrier: `<script setup>const components = _components; const data = _data</script>
          <template>
            <components.Receiver>
              <slot name="a"><span v-if="data.localA">local A</span></slot>
              <slot name="b" />
            </components.Receiver>
          </template>`,
        },
        data,
      )

      expect(container.textContent).toBe('B')
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()

      data.localA = true
      await nextTick()
      expect(container.textContent).toBe('local AB')

      data.localA = false
      await nextTick()
      expect(container.textContent).toBe('B')
    })

    test('hydrated vdom shared local fallback restores before its sibling', async () => {
      const data = reactive({ localA: true, showC: true })
      const { container } = await testWithVDOMApp(
        `<script setup>const components = _components</script>
        <template><components.Carrier /></template>`,
        {
          Receiver: `<template><slot><b>receiver fallback</b></slot></template>`,
          Carrier: `<script setup>const components = _components; const data = _data</script>
          <template>
            <components.Receiver>
              <slot name="a"><span v-if="data.localA">A</span></slot>
              <span v-if="data.showC">C</span>
            </components.Receiver>
          </template>`,
        },
        data,
      )

      expect(container.textContent).toBe('AC')
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()

      data.localA = false
      await nextTick()
      expect(container.textContent).toBe('C')

      data.localA = true
      await nextTick()
      expect(container.textContent).toBe('AC')
    })

    test('hydrated vdom local fallback restores before a stable sibling', async () => {
      const data = reactive({ localA: true })
      const { container } = await testWithVDOMApp(
        `<script setup>const components = _components</script>
        <template><components.Carrier /></template>`,
        {
          Receiver: `<template><slot><b>receiver fallback</b></slot></template>`,
          Carrier: `<script setup>const components = _components; const data = _data</script>
          <template>
            <components.Receiver>
              <slot name="a"><span v-if="data.localA">A</span></slot>
              <span>C</span>
            </components.Receiver>
          </template>`,
        },
        data,
      )

      expect(container.textContent).toBe('AC')
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()

      data.localA = false
      await nextTick()
      expect(container.textContent).toBe('C')
      data.localA = true
      await nextTick()
      expect(container.textContent).toBe('AC')
    })

    test('hydrated vdom content switches to local fallback after its sibling is removed', async () => {
      const data = reactive({ showProvided: true, showTail: true })
      const { container } = await testWithVDOMApp(
        `<script setup>const components = _components; const data = _data</script>
        <template>
          <components.Carrier>
            <template #a>
              <span v-if="data.showProvided">provided</span>
            </template>
          </components.Carrier>
        </template>`,
        {
          Receiver: `<template><slot><b>receiver fallback</b></slot></template>`,
          Carrier: `<script setup>const components = _components; const data = _data</script>
          <template>
            <components.Receiver>
              <slot name="a"><span>local fallback</span></slot>
              <span v-if="data.showTail">tail</span>
            </components.Receiver>
          </template>`,
        },
        data,
      )

      expect(container.textContent).toBe('providedtail')
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()

      data.showTail = false
      await nextTick()
      expect(container.textContent).toBe('provided')

      data.showProvided = false
      await nextTick()
      expect(container.textContent).toBe('local fallback')

      data.showProvided = true
      await nextTick()
      expect(container.textContent).toBe('provided')
    })

    test('hydrated vdom content switches inside a stable wrapper', async () => {
      const data = reactive({ showProvided: true, showTail: true })
      const { container } = await testWithVDOMApp(
        `<script setup>const components = _components; const data = _data</script>
        <template>
          <components.Carrier>
            <template #a>
              <span v-if="data.showProvided">provided</span>
            </template>
          </components.Carrier>
        </template>`,
        {
          Receiver: `<template><slot><b>receiver fallback</b></slot></template>`,
          Carrier: `<script setup>const components = _components; const data = _data</script>
          <template>
            <components.Receiver>
              <div>
                <slot name="a"><i>local fallback</i></slot>
                <span v-if="data.showTail">tail</span>
              </div>
            </components.Receiver>
          </template>`,
        },
        data,
      )

      expect(container.textContent).toBe('providedtail')
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()

      data.showTail = false
      await nextTick()
      expect(container.textContent).toBe('provided')

      data.showProvided = false
      await nextTick()
      expect(container.textContent).toBe('local fallback')

      data.showProvided = true
      await nextTick()
      expect(container.textContent).toBe('provided')
    })

    test('vdom nested hosts recover through a shared local fallback', async () => {
      const data = reactive({ showX: true, showY: false })
      const { container } = await testWithVDOMApp(
        `<script setup>const components = _components; const data = _data</script>
        <template>
          <components.Carrier>
            <template #x><span v-if="data.showX">X</span></template>
            <template #y><span v-if="data.showY">Y</span></template>
          </components.Carrier>
        </template>`,
        {
          Receiver: `<template><slot><b>receiver fallback</b></slot></template>`,
          Carrier: `<script setup>const components = _components</script>
          <template>
            <components.Receiver>
              <slot name="a"><slot name="x" /><slot name="y" /></slot>
              <slot name="b" />
            </components.Receiver>
          </template>`,
        },
        data,
      )

      expect(container.textContent).toBe('X')
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()

      data.showX = false
      await nextTick()
      expect(container.textContent).toBe('receiver fallback')

      data.showY = true
      await nextTick()
      expect(container.textContent).toBe('Y')
    })

    test('shared slot keeps its hydration position after a valid dynamic component', async () => {
      const data = reactive({ showB: false, showC: true })
      const { container } = await testHydration(
        `<script setup>const components = _components; const data = _data</script>
        <template>
          <components.Carrier>
            <template #b><span v-if="data.showB">B</span></template>
          </components.Carrier>
        </template>`,
        {
          Receiver: `<template><slot><b>receiver fallback</b></slot></template>`,
          Item: `<template><span>A</span></template>`,
          Carrier: `<script setup>const components = _components; const data = _data</script>
          <template>
            <components.Receiver>
              <component :is="components.Item" />
              <slot name="b" />
              <span v-if="data.showC">C</span>
            </components.Receiver>
          </template>`,
        },
        data,
      )

      expect(container.textContent).toBe('AC')
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()

      data.showB = true
      await nextTick()
      expect(container.textContent).toBe('ABC')
    })

    test('forwarded slot with empty content', async () => {
      const data = reactive({
        foo: 'foo',
      })
      const { container } = await testHydration(
        `<template>
          <components.Foo/>
        </template>`,
        {
          Foo: `<template>
                  <components.Bar>
                    <template #foo>
                      <slot name="foo" />
                    </template>
                  </components.Bar>
                </template>`,
          Bar: `<template>
                  <components.Baz>
                    <template #foo>
                      <slot name="foo" />
                    </template>
                  </components.Baz>
                </template>`,
          Baz: `<template>
                  <components.Qux>
                    <template #foo>
                      <slot name="foo" />
                    </template>
                  </components.Qux>
                </template>`,
          Qux: `<template>
                  <div>
                    <slot name="foo" />
                    <div>{{data.foo}}</div>
                  </div>
                </template>`,
        },
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
      	"<div>
      	<!--[--><!--]-->
      	<!--slot--><!--slot--><!--slot--><div>foo</div></div>"
      `,
      )

      data.foo = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
      	"<div>
      	<!--[--><!--]-->
      	<!--slot--><!--slot--><!--slot--><div>bar</div></div>"
      `,
      )
    })

    test('forwarded empty named slot with trailing sibling nodes', async () => {
      const { container } = await testHydration(
        `<template>
          <components.Layout>
            <template #banner>
              <div>banner</div>
            </template>
            <template #footer-before>
              <slot name="footer-before" />
            </template>
          </components.Layout>
        </template>`,
        {
          Layout: `<template>
            <div>
              <slot name="banner" />
              <components.Page>
                <template #footer-before>
                  <slot name="footer-before" />
                </template>
              </components.Page>
            </div>
          </template>`,
          Page: `<template>
            <div>
              <main><span>content</span></main>
              <slot name="footer-before" />
              <p>footer</p>
            </div>
          </template>`,
        },
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
      	"<div>
      	<!--[--><div>banner</div><!--]-->
      	<div><main><span>content</span></main>
      	<!--[--><!--]-->
      	<!--slot--><!--slot--><p>footer</p></div></div>"
      `,
      )
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    })

    test('forwarded named slot can appear after hydrating as empty', async () => {
      const data = reactive({
        show: false,
        foo: 'foo',
        bar: 'bar',
      })
      const { container } = await testHydration(
        `<template>
          <components.Foo>
            <template v-if="data.show" #foo>
              <span>{{data.foo}}</span>
            </template>
          </components.Foo>
        </template>`,
        {
          Foo: `<template>
                  <components.Bar>
                    <template #foo>
                      <slot name="foo" />
                    </template>
                  </components.Bar>
                </template>`,
          Bar: `<template>
                  <div>
                    <slot name="foo" />
                    <div>{{data.bar}}</div>
                  </div>
                </template>`,
        },
        data,
      )

      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
      	"<div>
      	<!--[--><!--]-->
      	<!--slot--><div>bar</div></div>"
      `,
      )

      data.show = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><span>foo</span><!--]-->
        <!--slot--><div>bar</div></div>"
      `,
      )

      data.foo = 'foo1'
      data.bar = 'bar1'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><span>foo1</span><!--]-->
        <!--slot--><div>bar1</div></div>"
      `,
      )
    })
  })
})
