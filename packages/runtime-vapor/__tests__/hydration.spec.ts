import {
  createVaporSSRApp,
  defineVaporAsyncComponent,
  delegateEvents,
} from '../src'
import { defineAsyncComponent, nextTick, reactive, ref } from '@vue/runtime-dom'
import { isString } from '@vue/shared'
import type { VaporComponentInstance } from '../src/component'
import type { TeleportFragment } from '../src/components/Teleport'
import { VueServerRenderer, compile, runtimeDom, runtimeVapor } from './_utils'

const formatHtml = (raw: string) => {
  return raw
    .replace(/<!--\[/g, '\n<!--[')
    .replace(/]-->/g, ']-->\n')
    .replace(/\n{2,}/g, '\n')
}

async function testWithVaporApp(
  code: string,
  components?: Record<string, string | { code: string; vapor: boolean }>,
  data?: any,
) {
  return testHydration(code, components, data, {
    isVaporApp: true,
    interop: true,
  })
}

async function testWithVDOMApp(
  code: string,
  components?: Record<string, string | { code: string; vapor: boolean }>,
  data?: any,
) {
  return testHydration(code, components, data, {
    isVaporApp: false,
    interop: true,
  })
}

function compileVaporComponent(
  code: string,
  data: runtimeDom.Ref<any> = ref({}),
  components?: Record<string, any>,
  ssr = false,
) {
  if (!code.includes(`<script`)) {
    code = `<template>${code}</template>`
  }
  return compile(code, data, components, {
    vapor: true,
    ssr,
  })
}

async function mountWithHydration(
  html: string,
  code: string,
  data: runtimeDom.Ref<any> = ref({}),
  components?: Record<string, any>,
) {
  const container = document.createElement('div')
  container.innerHTML = html
  document.body.appendChild(container)

  const clientComp = compileVaporComponent(code, data, components)
  const app = createVaporSSRApp(clientComp)
  app.mount(container)

  return {
    block: (app._instance! as VaporComponentInstance).block,
    container,
  }
}

async function testHydration(
  code: string,
  components: Record<string, string | { code: string; vapor: boolean }> = {},
  data: any = ref('foo'),
  { isVaporApp = true, interop = false } = {},
) {
  const ssrComponents: any = {}
  const clientComponents: any = {}
  for (const key in components) {
    const comp = components[key]
    const code = isString(comp) ? comp : comp.code
    const isVaporComp = isString(comp) || !!comp.vapor
    clientComponents[key] = compile(code, data, clientComponents, {
      vapor: isVaporComp,
      ssr: false,
    })
    ssrComponents[key] = compile(code, data, ssrComponents, {
      vapor: isVaporComp,
      ssr: true,
    })
  }

  const serverComp = compile(code, data, ssrComponents, {
    vapor: isVaporApp,
    ssr: true,
  })
  const html = await VueServerRenderer.renderToString(
    runtimeDom.createSSRApp(serverComp),
  )
  const container = document.createElement('div')
  document.body.appendChild(container)
  container.innerHTML = html

  const clientComp = compile(code, data, clientComponents, {
    vapor: isVaporApp,
    ssr: false,
  })
  let app
  if (isVaporApp) {
    app = createVaporSSRApp(clientComp)
  } else {
    app = runtimeDom.createSSRApp(clientComp)
  }

  if (interop) {
    app.use(runtimeVapor.vaporInteropPlugin)
  }

  app.mount(container)
  return { data, container }
}

const triggerEvent = (type: string, el: Element) => {
  const event = new Event(type, { bubbles: true })
  el.dispatchEvent(event)
}

delegateEvents('click')

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('Vapor Mode hydration', () => {
  describe('text', () => {
    test('root text', async () => {
      const { data, container } = await testHydration(`
      <template>{{ data }}</template>
    `)
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`"foo"`)

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`"bar"`)
    })

    test('consecutive text nodes', async () => {
      const { data, container } = await testHydration(`
      <template>{{ data }}{{ data }}</template>
    `)
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`"foofoo"`)

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`"barbar"`)
    })

    test('consecutive text nodes with insertion anchor', async () => {
      const { data, container } = await testHydration(`
      <template><span/>{{ data }}{{ data }}<span/></template>
    `)
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span></span>foofoo<span></span><!--]-->
        "
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span></span>barbar<span></span><!--]-->
        "
      `,
      )
    })

    test('mixed text nodes', async () => {
      const { data, container } = await testHydration(`
      <template>{{ data }}A{{ data }}B{{ data }}</template>
    `)
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"fooAfooBfoo"`,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"barAbarBbar"`,
      )
    })

    test('mixed text nodes with insertion anchor', async () => {
      const { data, container } = await testHydration(`
      <template><span/>{{ data }}A{{ data }}B{{ data }}<span/></template>
    `)
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span></span>fooAfooBfoo<span></span><!--]-->
        "
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span></span>barAbarBbar<span></span><!--]-->
        "
      `,
      )
    })

    test('empty text node', async () => {
      const data = reactive({ txt: '' })
      const { container } = await testHydration(
        `<template><div>{{ data.txt }}</div></template>`,
        undefined,
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div></div>"`,
      )

      data.txt = 'foo'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div>foo</div>"`,
      )
    })

    test('empty text node in slot', async () => {
      const data = reactive({ txt: '' })
      const { container } = await testHydration(
        `<template><components.Child>{{data.txt}}</components.Child></template>`,
        {
          Child: `<template><slot/></template>`,
        },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><!--]-->
        "
      `,
      )

      data.txt = 'foo'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[-->foo<!--]-->
        "
      `,
      )
    })
  })

  describe('element', () => {
    test('root comment', async () => {
      const { container } = await testHydration(`
      <template><!----></template>
    `)
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`"<!---->"`)
      expect(`mismatch in <div>`).not.toHaveBeenWarned()
    })

    test('root with mixed element and text', async () => {
      const { container, data } = await testHydration(`
      <template> A<span>{{ data }}</span>{{ data }}</template>
    `)
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--> A<span>foo</span>foo<!--]-->
        "
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--> A<span>bar</span>bar<!--]-->
        "
      `,
      )
    })

    test('empty element', async () => {
      const { container } = await testHydration(`
      <template><div/></template>
    `)
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div></div>"`,
      )
      expect(`mismatch in <div>`).not.toHaveBeenWarned()
    })

    test('element with binding and text children', async () => {
      const { container, data } = await testHydration(`
      <template><div :class="data">{{ data }}</div></template>
    `)
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div class="foo">foo</div>"`,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div class="bar">bar</div>"`,
      )
    })

    test('element with elements children', async () => {
      const { container } = await testHydration(`
      <template>
        <div>
          <span>{{ data }}</span>
          <span :class="data" @click="data = 'bar'"/>
        </div>
      </template>
    `)
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span>foo</span><span class="foo"></span></div>"`,
      )

      // event handler
      triggerEvent('click', container.querySelector('.foo')!)

      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span>bar</span><span class="bar"></span></div>"`,
      )
    })

    test('element with ref', async () => {
      const { data, container } = await testHydration(
        `<template>
          <div ref="data">hi</div>
        </template>
      `,
        {},
        ref(null),
      )

      expect(data.value).toBe(container.firstChild)
    })
  })

  describe('component', () => {
    test('basic component', async () => {
      const { container, data } = await testHydration(
        `
      <template><div><span></span><components.Child/></div></template>
      `,
        { Child: `<template>{{ data }}</template>` },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span>foo</div>"`,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span>bar</div>"`,
      )
    })

    test('fragment component', async () => {
      const { container, data } = await testHydration(
        `
      <template><div><span></span><components.Child/></div></template>
      `,
        { Child: `<template><div>{{ data }}</div>-{{ data }}-</template>` },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><div>foo</div>-foo-<!--]-->
        </div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><div>bar</div>-bar-<!--]-->
        </div>"
      `,
      )
    })

    test('fragment component with prepend', async () => {
      const { container, data } = await testHydration(
        `
      <template><div><components.Child/><span></span></div></template>
      `,
        { Child: `<template><div>{{ data }}</div>-{{ data }}-</template>` },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><div>foo</div>-foo-<!--]-->
        <span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><div>bar</div>-bar-<!--]-->
        <span></span></div>"
      `,
      )
    })

    test('nested fragment components', async () => {
      const { container, data } = await testHydration(
        `
      <template><div><components.Parent/><span></span></div></template>
      `,
        {
          Parent: `<template><div/><components.Child/><div/></template>`,
          Child: `<template><div>{{ data }}</div>-{{ data }}-</template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><div></div>
        <!--[--><div>foo</div>-foo-<!--]-->
        <div></div><!--]-->
        <span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><div></div>
        <!--[--><div>bar</div>-bar-<!--]-->
        <div></div><!--]-->
        <span></span></div>"
      `,
      )
    })

    test('component with insertion anchor', async () => {
      const { container, data } = await testHydration(
        `<template>
        <div>
          <span/>
          <components.Child/>
          <span/>
        </div>
      </template>
      `,
        {
          Child: `<template>{{ data }}</template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span>foo<span></span></div>"`,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span>bar<span></span></div>"`,
      )
    })

    test('nested components with insertion anchor', async () => {
      const { container, data } = await testHydration(
        `
      <template><components.Parent/></template>
      `,
        {
          Parent: `<template><div><span/><components.Child/><span/></div></template>`,
          Child: `<template><div>{{ data }}</div></template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span><div>foo</div><span></span></div>"`,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span><div>bar</div><span></span></div>"`,
      )
    })

    test('nested components with multi level anchor insertion', async () => {
      const { container, data } = await testHydration(
        `
      <template><div><span></span><components.Parent/><span></span></div></template>
      `,
        {
          Parent: `<template><div><span/><components.Child/><span/></div></template>`,
          Child: `<template><div>{{ data }}</div></template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span><div><span></span><div>foo</div><span></span></div><span></span></div>"`,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span><div><span></span><div>bar</div><span></span></div><span></span></div>"`,
      )
    })

    test('consecutive components with insertion parent', async () => {
      const data = reactive({ foo: 'foo', bar: 'bar' })
      const { container } = await testHydration(
        `<template>
        <div>
          <components.Child1/>
          <components.Child2/>
        </div>
      </template>
      `,
        {
          Child1: `<template><span>{{ data.foo }}</span></template>`,
          Child2: `<template><span>{{ data.bar }}</span></template>`,
        },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span>foo</span><span>bar</span></div>"`,
      )

      data.foo = 'foo1'
      data.bar = 'bar1'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span>foo1</span><span>bar1</span></div>"`,
      )
    })

    test('nested consecutive components with insertion anchor', async () => {
      const { container, data } = await testHydration(
        `
      <template><components.Parent/></template>
      `,
        {
          Parent: `<template><div><span/><components.Child/><components.Child/><span/></div></template>`,
          Child: `<template><div>{{ data }}</div></template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span><div>foo</div><div>foo</div><span></span></div>"`,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span><div>bar</div><div>bar</div><span></span></div>"`,
      )
    })

    test('nested consecutive components with multi level anchor insertion', async () => {
      const { container, data } = await testHydration(
        `
      <template><div><span></span><components.Parent/><span></span></div></template>
      `,
        {
          Parent: `<template><div><span/><components.Child/><components.Child/><span/></div></template>`,
          Child: `<template><div>{{ data }}</div></template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span><div><span></span><div>foo</div><div>foo</div><span></span></div><span></span></div>"`,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span><div><span></span><div>bar</div><div>bar</div><span></span></div><span></span></div>"`,
      )
    })

    test('mixed component and element with insertion anchor', async () => {
      const { container, data } = await testHydration(
        `<template>
        <div>
          <span/>
          <components.Child/>
          <span/>
          <components.Child/>
          <span/>
        </div>
      </template>
      `,
        {
          Child: `<template>{{ data }}</template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span>foo<span></span>foo<span></span></div>"`,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span>bar<span></span>bar<span></span></div>"`,
      )
    })

    test('fragment component with insertion anchor', async () => {
      const { container, data } = await testHydration(
        `<template>
        <div>
          <span/>
          <components.Child/>
          <span/>
        </div>
      </template>
      `,
        {
          Child: `<template><div>{{ data }}</div>-{{ data }}</template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><div>foo</div>-foo<!--]-->
        <span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><div>bar</div>-bar<!--]-->
        <span></span></div>"
      `,
      )
    })

    test('nested fragment component with insertion anchor', async () => {
      const { container, data } = await testHydration(
        `
      <template><components.Parent/></template>
      `,
        {
          Parent: `<template><div><span/><components.Child/><span/></div></template>`,
          Child: `<template><div>{{ data }}</div>-{{ data }}-</template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><div>foo</div>-foo-<!--]-->
        <span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><div>bar</div>-bar-<!--]-->
        <span></span></div>"
      `,
      )
    })

    test('nested fragment component with multi level anchor insertion', async () => {
      const { container, data } = await testHydration(
        `
      <template><div><span/><components.Parent/><span/></div></template>
      `,
        {
          Parent: `<template><div><span/><components.Child/><span/></div></template>`,
          Child: `<template><div>{{ data }}</div>-{{ data }}-</template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span><div><span></span>
        <!--[--><div>foo</div>-foo-<!--]-->
        <span></span></div><span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span><div><span></span>
        <!--[--><div>bar</div>-bar-<!--]-->
        <span></span></div><span></span></div>"
      `,
      )
    })

    test('consecutive fragment components with insertion anchor', async () => {
      const { container, data } = await testHydration(
        `<template>
          <div>
            <span/>
            <components.Child/>
            <components.Child/>
            <span/>
          </div>
        </template>
      `,
        {
          Child: `<template><div>{{ data }}</div>-{{ data }}</template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><div>foo</div>-foo<!--]-->
        <!--[--><div>foo</div>-foo<!--]-->
        <span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><div>bar</div>-bar<!--]-->
        <!--[--><div>bar</div>-bar<!--]-->
        <span></span></div>"
      `,
      )
    })

    test('nested consecutive fragment components with insertion anchor', async () => {
      const { container, data } = await testHydration(
        `
      <template><components.Parent/></template>
      `,
        {
          Parent: `<template><div><span/><components.Child/><components.Child/><span/></div></template>`,
          Child: `<template><div>{{ data }}</div>-{{ data }}-</template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><div>foo</div>-foo-<!--]-->
        <!--[--><div>foo</div>-foo-<!--]-->
        <span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><div>bar</div>-bar-<!--]-->
        <!--[--><div>bar</div>-bar-<!--]-->
        <span></span></div>"
      `,
      )
    })

    test('nested consecutive fragment components with multi level anchor insertion', async () => {
      const { container, data } = await testHydration(
        `
      <template><div><span></span><components.Parent/><span></span></div></template>
      `,
        {
          Parent: `<template><div><span/><components.Child/><components.Child/><span/></div></template>`,
          Child: `<template><div>{{ data }}</div>-{{ data }}-</template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span><div><span></span>
        <!--[--><div>foo</div>-foo-<!--]-->
        <!--[--><div>foo</div>-foo-<!--]-->
        <span></span></div><span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span><div><span></span>
        <!--[--><div>bar</div>-bar-<!--]-->
        <!--[--><div>bar</div>-bar-<!--]-->
        <span></span></div><span></span></div>"
      `,
      )
    })

    test('nested consecutive fragment components with root level anchor insertion', async () => {
      const { container, data } = await testHydration(
        `
      <template><div><span></span><components.Parent/><span></span></div></template>
      `,
        {
          Parent: `<template><components.Child/><components.Child/></template>`,
          Child: `<template><div>{{ data }}</div>-{{ data }}-</template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[-->
        <!--[--><div>foo</div>-foo-<!--]-->
        <!--[--><div>foo</div>-foo-<!--]-->
        <!--]-->
        <span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[-->
        <!--[--><div>bar</div>-bar-<!--]-->
        <!--[--><div>bar</div>-bar-<!--]-->
        <!--]-->
        <span></span></div>"
      `,
      )
    })

    test('mixed fragment component and element with insertion anchor', async () => {
      const { container, data } = await testHydration(
        `<template>
        <div>
          <span/>
          <components.Child/>
          <span/>
          <components.Child/>
          <span/>
        </div>
      </template>
      `,
        {
          Child: `<template><div>{{ data }}</div>-{{ data }}</template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><div>foo</div>-foo<!--]-->
        <span></span>
        <!--[--><div>foo</div>-foo<!--]-->
        <span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><div>bar</div>-bar<!--]-->
        <span></span>
        <!--[--><div>bar</div>-bar<!--]-->
        <span></span></div>"
      `,
      )
    })

    test('mixed fragment component and text with insertion anchor', async () => {
      const { container, data } = await testHydration(
        `<template>
        <div>
          <span/>
          <components.Child/>
          {{ data }}
          <components.Child/>
          <span/>
        </div>
      </template>
      `,
        {
          Child: `<template><div>{{ data }}</div>-{{ data }}</template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><div>foo</div>-foo<!--]-->
         foo 
        <!--[--><div>foo</div>-foo<!--]-->
        <span></span></div>"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><div>bar</div>-bar<!--]-->
         bar 
        <!--[--><div>bar</div>-bar<!--]-->
        <span></span></div>"
      `,
      )
    })
  })

  describe('dynamic component', () => {
    test('basic dynamic component', async () => {
      const { container, data } = await testHydration(
        `<template>
          <component :is="components[data]"/>
        </template>`,
        {
          foo: `<template><div>foo</div></template>`,
          bar: `<template><div>bar</div></template>`,
        },
        ref('foo'),
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div>foo</div><!--dynamic-component-->"`,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div>bar</div><!--dynamic-component-->"`,
      )
    })

    test('dynamic component with insertion anchor', async () => {
      const { container, data } = await testHydration(
        `<template>
          <div>
            <span/>
            <component :is="components[data]"/>
            <span/>
          </div>
        </template>`,
        {
          foo: `<template><div>foo</div></template>`,
          bar: `<template><div>bar</div></template>`,
        },
        ref('foo'),
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span><div>foo</div><!--dynamic-component--><span></span></div>"`,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span><div>bar</div><!--dynamic-component--><span></span></div>"`,
      )
    })

    test('consecutive dynamic components with insertion anchor', async () => {
      const { container, data } = await testHydration(
        `<template>
          <div>
            <span/>
            <component :is="components[data]"/>
            <component :is="components[data]"/>
            <span/>
          </div>
        </template>`,
        {
          foo: `<template><div>foo</div></template>`,
          bar: `<template><div>bar</div></template>`,
        },
        ref('foo'),
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span><div>foo</div><!--dynamic-component--><div>foo</div><!--dynamic-component--><span></span></div>"`,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div><span></span><div>bar</div><!--dynamic-component--><div>bar</div><!--dynamic-component--><span></span></div>"`,
      )
    })

    test('dynamic component fallback', async () => {
      const { container, data } = await testHydration(
        `<template>
            <component :is="'button'">
              <span>{{ data }}</span>
            </component>
          </template>`,
        {},
        ref('foo'),
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<button><span>foo</span></button><!--dynamic-component-->"`,
      )
      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<button><span>bar</span></button><!--dynamic-component-->"`,
      )
    })

    test('in ssr slot vnode fallback', async () => {
      const { container, data } = await testHydration(
        `<template>
            <components.Child>
              <span>{{ data }}</span>
            </components.Child>
          </template>`,
        {
          Child: `
          <template>
            <component :is="'div'">
              <slot />
            </component>
          </template>`,
        },
        ref('foo'),
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><span>foo</span><!--]-->
        </div><!--dynamic-component-->"
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><span>bar</span><!--]-->
        </div><!--dynamic-component-->"
      `,
      )
    })
  })

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
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<!--if-->"`,
      )

      data.value = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<div>foo</div><!--if-->"`,
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
  })

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

  describe('slots', () => {
    test('basic slot', async () => {
      const { data, container } = await testHydration(
        `<template>
          <components.Child>
            <span>{{data}}</span>
          </components.Child>
        </template>`,
        {
          Child: `<template><slot/></template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span>foo</span><!--]-->
        "
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span>bar</span><!--]-->
        "
      `,
      )
    })

    test('named slot', async () => {
      const { data, container } = await testHydration(
        `<template>
          <components.Child>
            <template #foo>
              <span>{{data}}</span>
            </template>
          </components.Child>
        </template>`,
        {
          Child: `<template><slot/><slot name="foo"/></template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[-->
        <!--[--><!--]-->
        <!--[--><span>foo</span><!--]-->
        <!--]-->
        "
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[-->
        <!--[--><!--]-->
        <!--[--><span>bar</span><!--]-->
        <!--]-->
        "
      `,
      )
    })

    test('named slot with v-if', async () => {
      const { data, container } = await testHydration(
        `<template>
          <components.Child>
            <template #foo v-if="data">
              <span>{{data}}</span>
            </template>
          </components.Child>
        </template>`,
        {
          Child: `<template><slot name="foo"/></template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span>foo</span><!--]-->
        "
      `,
      )

      data.value = false
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><!--]-->
        "
      `,
      )

      data.value = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
        "
        <!--[--><span>true</span><!--]-->
        "
      `)
    })

    test('named slot with v-if and v-for', async () => {
      const data = reactive({
        show: true,
        items: ['a', 'b', 'c'],
      })
      const { container } = await testHydration(
        `<template>
          <components.Child>
            <template #foo v-if="data.show">
              <span v-for="item in data.items" :key="item">{{item}}</span>
            </template>
          </components.Child>
        </template>`,
        {
          Child: `<template><slot name="foo"/></template>`,
        },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[-->
        <!--[--><span>a</span><span>b</span><span>c</span><!--]-->
        <!--]-->
        "
      `,
      )

      data.show = false
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[-->
        <!--[--><!--]-->
        "
      `,
      )

      data.show = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[-->
        <!--[--><span>a</span><span>b</span><span>c</span><!--for--><!--]-->
        "
      `,
      )
    })

    test('with insertion anchor', async () => {
      const { data, container } = await testHydration(
        `<template>
          <components.Child>
            <span/>
            <span>{{data}}</span>
            <span/>
          </components.Child>
        </template>`,
        {
          Child: `<template><slot/></template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span></span><span>foo</span><span></span><!--]-->
        "
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span></span><span>bar</span><span></span><!--]-->
        "
      `,
      )
    })

    test('with multi level anchor insertion', async () => {
      const { data, container } = await testHydration(
        `<template>
          <components.Child>
            <span/>
            <span>{{data}}</span>
            <span/>
          </components.Child>
        </template>`,
        {
          Child: `
          <template>
            <div/>
              <div/>
              <slot/>
              <div/>
            </div>
          </template>`,
        },
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div></div><div></div>
        <!--[--><span></span><span>foo</span><span></span><!--]-->
        <div></div><!--]-->
        "
      `,
      )

      data.value = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div></div><div></div>
        <!--[--><span></span><span>bar</span><span></span><!--]-->
        <div></div><!--]-->
        "
      `,
      )
    })

    test('mixed slot and text node', async () => {
      const data = reactive({
        text: 'foo',
        msg: 'hi',
      })
      const { container } = await testHydration(
        `<template>
          <components.Child>
            <span>{{data.text}}</span>
          </components.Child>
        </template>`,
        {
          Child: `<template><div><slot/>{{data.msg}}</div></template>`,
        },
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><span>foo</span><!--]-->
        hi</div>"
      `,
      )

      data.msg = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><span>foo</span><!--]-->
        bar</div>"
      `,
      )
    })

    test('mixed root slot and text node', async () => {
      const data = reactive({
        text: 'foo',
        msg: 'hi',
      })
      const { container } = await testHydration(
        `<template>
          <components.Child>
            <span>{{data.text}}</span>
          </components.Child>
        </template>`,
        {
          Child: `<template>{{data.text}}<slot/>{{data.msg}}</template>`,
        },
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[-->foo
        <!--[--><span>foo</span><!--]-->
        hi<!--]-->
        "
      `,
      )

      data.msg = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[-->foo
        <!--[--><span>foo</span><!--]-->
        bar<!--]-->
        "
      `,
      )
    })

    test('mixed consecutive slot and element', async () => {
      const data = reactive({
        text: 'foo',
        msg: 'hi',
      })
      const { container } = await testHydration(
        `<template>
          <components.Child>
            <template #foo><span>{{data.text}}</span></template>
            <template #bar><span>bar</span></template>
          </components.Child>
        </template>`,
        {
          Child: `<template><div><slot name="foo"/><slot name="bar"/><div>{{data.msg}}</div></div></template>`,
        },
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><span>foo</span><!--]-->
        <!--[--><span>bar</span><!--]-->
        <div>hi</div></div>"
      `,
      )

      data.msg = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><span>foo</span><!--]-->
        <!--[--><span>bar</span><!--]-->
        <div>bar</div></div>"
      `,
      )
    })

    test('mixed slot and element', async () => {
      const data = reactive({
        text: 'foo',
        msg: 'hi',
      })
      const { container } = await testHydration(
        `<template>
          <components.Child>
            <span>{{data.text}}</span>
          </components.Child>
        </template>`,
        {
          Child: `<template><div><slot/><div>{{data.msg}}</div></div></template>`,
        },
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><span>foo</span><!--]-->
        <div>hi</div></div>"
      `,
      )

      data.msg = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><span>foo</span><!--]-->
        <div>bar</div></div>"
      `,
      )
    })

    test('mixed slot and component', async () => {
      const data = reactive({
        msg1: 'foo',
        msg2: 'bar',
      })
      const { container } = await testHydration(
        `<template>
          <components.Child>
            <span>{{data.msg1}}</span>
          </components.Child>
        </template>`,
        {
          Child: `
          <template>
            <div>
              <components.Child2/>
              <slot/>
              <components.Child2/>
            </div>
          </template>`,
          Child2: `
          <template>
            <div>{{data.msg2}}</div>
          </template>`,
        },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><div>bar</div>
        <!--[--><span>foo</span><!--]-->
        <div>bar</div></div>"
      `,
      )

      data.msg2 = 'hello'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><div>hello</div>
        <!--[--><span>foo</span><!--]-->
        <div>hello</div></div>"
      `,
      )
    })

    test('mixed slot and fragment component', async () => {
      const data = reactive({
        msg1: 'foo',
        msg2: 'bar',
      })
      const { container } = await testHydration(
        `<template>
          <components.Child>
            <span>{{data.msg1}}</span>
          </components.Child>
        </template>`,
        {
          Child: `
          <template>
            <div>
              <components.Child2/>
              <slot/>
              <components.Child2/>
            </div>
          </template>`,
          Child2: `
          <template>
            <div>{{data.msg1}}</div> {{data.msg2}}
          </template>`,
        },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><div>foo</div> bar<!--]-->
        <!--[--><span>foo</span><!--]-->
        <!--[--><div>foo</div> bar<!--]-->
        </div>"
      `,
      )

      data.msg1 = 'hello'
      data.msg2 = 'vapor'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><div>hello</div> vapor<!--]-->
        <!--[--><span>hello</span><!--]-->
        <!--[--><div>hello</div> vapor<!--]-->
        </div>"
      `,
      )
    })

    test('mixed slot and v-if', async () => {
      const data = reactive({
        show: true,
        msg: 'foo',
      })
      const { container } = await testHydration(
        `<template>
          <components.Child>
            <span>{{data.msg}}</span>
          </components.Child>
        </template>`,
        {
          Child: `
          <template>
            <div v-if="data.show">{{data.msg}}</div>
            <slot/>
            <div v-if="data.show">{{data.msg}}</div>
          </template>`,
        },
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><div>foo</div><!--if-->
        <!--[--><span>foo</span><!--]-->
        <div>foo</div><!--if--><!--]-->
        "
      `,
      )

      data.show = false
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><!--if-->
        <!--[--><span>foo</span><!--]-->
        <!--if--><!--]-->
        "
      `,
      )

      data.show = true
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
        "
        <!--[--><div>foo</div><!--if-->
        <!--[--><span>foo</span><!--]-->
        <div>foo</div><!--if--><!--]-->
        "
      `)
    })

    test('mixed slot and v-for', async () => {
      const data = reactive({
        items: ['a', 'b', 'c'],
        msg: 'foo',
      })
      const { container } = await testHydration(
        `<template>
          <components.Child>
            <span>{{data.msg}}</span>
          </components.Child>
        </template>`,
        {
          Child: `
          <template>
            <div v-for="item in data.items" :key="item">{{item}}</div>
            <slot/>
            <div v-for="item in data.items" :key="item">{{item}}</div>
          </template>`,
        },
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[-->
        <!--[--><div>a</div><div>b</div><div>c</div><!--]-->
        <!--[--><span>foo</span><!--]-->
        <!--[--><div>a</div><div>b</div><div>c</div><!--]-->
        <!--]-->
        "
      `,
      )

      data.items.push('d')
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[-->
        <!--[--><div>a</div><div>b</div><div>c</div><div>d</div><!--]-->
        <!--[--><span>foo</span><!--]-->
        <!--[--><div>a</div><div>b</div><div>c</div><div>d</div><!--]-->
        <!--]-->
        "
      `,
      )
    })

    test('consecutive slots', async () => {
      const data = reactive({
        msg1: 'foo',
        msg2: 'bar',
      })

      const { container } = await testHydration(
        `<template>
          <components.Child>
            <span>{{data.msg1}}</span>
            <template #bar>
              <span>{{data.msg2}}</span>
            </template>
          </components.Child>
        </template>`,
        {
          Child: `<template><slot/><slot name="bar"/></template>`,
        },
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[-->
        <!--[--><span>foo</span><!--]-->
        <!--[--><span>bar</span><!--]-->
        <!--]-->
        "
      `,
      )

      data.msg1 = 'hello'
      data.msg2 = 'vapor'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[-->
        <!--[--><span>hello</span><!--]-->
        <!--[--><span>vapor</span><!--]-->
        <!--]-->
        "
      `,
      )
    })

    test('consecutive slots with insertion anchor', async () => {
      const data = reactive({
        msg1: 'foo',
        msg2: 'bar',
      })

      const { container } = await testHydration(
        `<template>
          <components.Child>
            <span>{{data.msg1}}</span>
            <template #bar>
              <span>{{data.msg2}}</span>
            </template>
          </components.Child>
        </template>`,
        {
          Child: `<template>
            <div>
              <span/>
              <slot/>
              <slot name="bar"/>
              <span/>
            </div>
          </template>`,
        },
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><span>foo</span><!--]-->
        <!--[--><span>bar</span><!--]-->
        <span></span></div>"
      `,
      )

      data.msg1 = 'hello'
      data.msg2 = 'vapor'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div><span></span>
        <!--[--><span>hello</span><!--]-->
        <!--[--><span>vapor</span><!--]-->
        <span></span></div>"
      `,
      )
    })

    test('consecutive slots prepend', async () => {
      const data = reactive({
        msg1: 'foo',
        msg2: 'bar',
        msg3: 'baz',
      })

      const { container } = await testHydration(
        `<template>
          <components.Child>
            <template #foo>
              <span>{{data.msg1}}</span>
            </template>
            <template #bar>
              <span>{{data.msg2}}</span>
            </template>
          </components.Child>
        </template>`,
        {
          Child: `<template>
            <div>
              <slot name="foo"/>
              <slot name="bar"/>
              <div>{{data.msg3}}</div>
            </div>
          </template>`,
        },
        data,
      )

      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><span>foo</span><!--]-->
        <!--[--><span>bar</span><!--]-->
        <div>baz</div></div>"
      `,
      )

      data.msg1 = 'hello'
      data.msg2 = 'vapor'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><span>hello</span><!--]-->
        <!--[--><span>vapor</span><!--]-->
        <div>baz</div></div>"
      `,
      )
    })

    test('slot fallback', async () => {
      const data = reactive({
        foo: 'foo',
      })
      const { container } = await testHydration(
        `<template>
          <components.Child>
          </components.Child>
        </template>`,
        {
          Child: `<template><slot><span>{{data.foo}}</span></slot></template>`,
        },
        data,
      )
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span>foo</span><!--]-->
        "
      `,
      )

      data.foo = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "
        <!--[--><span>bar</span><!--]-->
        "
      `,
      )
    })

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
        <!--[-->foo<!--]-->
        </div>"
      `,
      )

      data.foo = 'foo1'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[-->foo1<!--]-->
        </div>"
      `,
      )
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
        <div>foo</div></div>"
      `,
      )

      data.foo = 'bar'
      await nextTick()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `
        "<div>
        <!--[--><!--]-->
        <div>bar</div></div>"
      `,
      )
    })
  })

  describe('transition', async () => {
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
        `"<!--slot--><!--if-->"`,
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
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
        `"<!--if-->"`,
      )
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
        `"<div style="display:none;" class="v-enter-from v-enter-active v-leave-from v-leave-active">foo</div>"`,
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
  })

  describe('teleport', () => {
    test('basic', async () => {
      const data = ref({
        msg: ref('foo'),
        disabled: ref(false),
        fn: vi.fn(),
      })

      const teleportContainer = document.createElement('div')
      teleportContainer.id = 'teleport'
      teleportContainer.innerHTML =
        `<!--teleport start anchor-->` +
        `<span>foo</span>` +
        `<span class="foo"></span>` +
        `<!--teleport anchor-->`
      document.body.appendChild(teleportContainer)

      const { block, container } = await mountWithHydration(
        '<!--teleport start--><!--teleport end-->',
        `<teleport to="#teleport" :disabled="data.disabled">
          <span>{{data.msg}}</span>
          <span :class="data.msg" @click="data.fn"></span>
        </teleport>`,
        data,
      )

      const teleport = block as TeleportFragment
      expect(teleport.anchor).toBe(container.lastChild)
      expect(teleport.target).toBe(teleportContainer)
      expect(teleport.targetStart).toBe(teleportContainer.childNodes[0])
      expect((teleport.nodes as Node[])[0]).toBe(
        teleportContainer.childNodes[1],
      )
      expect((teleport.nodes as Node[])[1]).toBe(
        teleportContainer.childNodes[2],
      )
      expect(teleport.targetAnchor).toBe(teleportContainer.childNodes[3])

      expect(container.innerHTML).toMatchInlineSnapshot(
        `"<!--teleport start--><!--teleport end-->"`,
      )

      // event handler
      triggerEvent('click', teleportContainer.querySelector('.foo')!)
      expect(data.value.fn).toHaveBeenCalled()

      data.value.msg = 'bar'
      await nextTick()
      expect(formatHtml(teleportContainer.innerHTML)).toBe(
        `<!--teleport start anchor-->` +
          `<span>bar</span>` +
          `<span class="bar"></span>` +
          `<!--teleport anchor-->`,
      )

      data.value.disabled = true
      await nextTick()
      expect(container.innerHTML).toBe(
        `<!--teleport start-->` +
          `<span>bar</span>` +
          `<span class="bar"></span>` +
          `<!--teleport end-->`,
      )
      expect(formatHtml(teleportContainer.innerHTML)).toMatchInlineSnapshot(
        `"<!--teleport start anchor--><!--teleport anchor-->"`,
      )

      data.value.msg = 'baz'
      await nextTick()
      expect(container.innerHTML).toBe(
        `<!--teleport start-->` +
          `<span>baz</span>` +
          `<span class="baz"></span>` +
          `<!--teleport end-->`,
      )

      data.value.disabled = false
      await nextTick()
      expect(container.innerHTML).toMatchInlineSnapshot(
        `"<!--teleport start--><!--teleport end-->"`,
      )
      expect(formatHtml(teleportContainer.innerHTML)).toBe(
        `<!--teleport start anchor-->` +
          `<span>baz</span>` +
          `<span class="baz"></span>` +
          `<!--teleport anchor-->`,
      )
    })

    test('multiple + integration', async () => {
      const data = ref({
        msg: ref('foo'),
        fn1: vi.fn(),
        fn2: vi.fn(),
      })

      const code = `
          <teleport to="#teleport2">
            <span>{{data.msg}}</span>
            <span :class="data.msg" @click="data.fn1"></span>
          </teleport>
          <teleport to="#teleport2">
            <span>{{data.msg}}2</span>
            <span :class="data.msg + 2" @click="data.fn2"></span>
          </teleport>`

      const SSRComp = compileVaporComponent(code, data, undefined, true)
      const teleportContainer = document.createElement('div')
      teleportContainer.id = 'teleport2'
      const ctx = {} as any
      const mainHtml = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRComp),
        ctx,
      )
      expect(mainHtml).toBe(
        `<!--[-->` +
          `<!--teleport start--><!--teleport end-->` +
          `<!--teleport start--><!--teleport end-->` +
          `<!--]-->`,
      )

      const teleportHtml = ctx.teleports!['#teleport2']
      expect(teleportHtml).toBe(
        `<!--teleport start anchor-->` +
          `<span>foo</span><span class="foo"></span>` +
          `<!--teleport anchor-->` +
          `<!--teleport start anchor-->` +
          `<span>foo2</span><span class="foo2"></span>` +
          `<!--teleport anchor-->`,
      )

      teleportContainer.innerHTML = teleportHtml
      document.body.appendChild(teleportContainer)

      const { block, container } = await mountWithHydration(
        mainHtml,
        code,
        data,
      )

      const teleports = block as any as TeleportFragment[]
      const teleport1 = teleports[0]
      const teleport2 = teleports[1]
      expect(teleport1.anchor).toBe(container.childNodes[2])
      expect(teleport2.anchor).toBe(container.childNodes[4])

      expect(teleport1.target).toBe(teleportContainer)
      expect(teleport1.targetStart).toBe(teleportContainer.childNodes[0])
      expect((teleport1.nodes as Node[])[0]).toBe(
        teleportContainer.childNodes[1],
      )
      expect(teleport1.targetAnchor).toBe(teleportContainer.childNodes[3])

      expect(teleport2.target).toBe(teleportContainer)
      expect(teleport2.targetStart).toBe(teleportContainer.childNodes[4])
      expect((teleport2.nodes as Node[])[0]).toBe(
        teleportContainer.childNodes[5],
      )
      expect(teleport2.targetAnchor).toBe(teleportContainer.childNodes[7])

      expect(container.innerHTML).toBe(
        `<!--[-->` +
          `<!--teleport start--><!--teleport end-->` +
          `<!--teleport start--><!--teleport end-->` +
          `<!--]-->`,
      )

      // event handler
      triggerEvent('click', teleportContainer.querySelector('.foo')!)
      expect(data.value.fn1).toHaveBeenCalled()

      triggerEvent('click', teleportContainer.querySelector('.foo2')!)
      expect(data.value.fn2).toHaveBeenCalled()

      data.value.msg = 'bar'
      await nextTick()
      expect(teleportContainer.innerHTML).toBe(
        `<!--teleport start anchor-->` +
          `<span>bar</span>` +
          `<span class="bar"></span>` +
          `<!--teleport anchor-->` +
          `<!--teleport start anchor-->` +
          `<span>bar2</span>` +
          `<span class="bar2"></span>` +
          `<!--teleport anchor-->`,
      )
    })

    test('disabled', async () => {
      const data = ref({
        msg: ref('foo'),
        fn1: vi.fn(),
        fn2: vi.fn(),
      })

      const code = `
          <div>foo</div>
          <teleport to="#teleport3" disabled="true">
            <span>{{data.msg}}</span>
            <span :class="data.msg" @click="data.fn1"></span>
          </teleport>
          <div :class="data.msg + 2" @click="data.fn2">bar</div>
          `

      const SSRComp = compileVaporComponent(code, data, undefined, true)
      const teleportContainer = document.createElement('div')
      teleportContainer.id = 'teleport3'
      const ctx = {} as any
      const mainHtml = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRComp),
        ctx,
      )
      expect(mainHtml).toBe(
        `<!--[-->` +
          `<div>foo</div>` +
          `<!--teleport start-->` +
          `<span>foo</span>` +
          `<span class="foo"></span>` +
          `<!--teleport end-->` +
          `<div class="foo2">bar</div>` +
          `<!--]-->`,
      )

      const teleportHtml = ctx.teleports!['#teleport3']
      expect(teleportHtml).toMatchInlineSnapshot(
        `"<!--teleport start anchor--><!--teleport anchor-->"`,
      )

      teleportContainer.innerHTML = teleportHtml
      document.body.appendChild(teleportContainer)

      const { block, container } = await mountWithHydration(
        mainHtml,
        code,
        data,
      )

      const blocks = block as any[]
      expect(blocks[0]).toBe(container.childNodes[1])

      const teleport = blocks[1] as TeleportFragment
      expect((teleport.nodes as Node[])[0]).toBe(container.childNodes[3])
      expect((teleport.nodes as Node[])[1]).toBe(container.childNodes[4])
      expect(teleport.anchor).toBe(container.childNodes[5])
      expect(teleport.target).toBe(teleportContainer)
      expect(teleport.targetStart).toBe(teleportContainer.childNodes[0])
      expect(teleport.targetAnchor).toBe(teleportContainer.childNodes[1])
      expect(blocks[2]).toBe(container.childNodes[6])

      expect(container.innerHTML).toBe(
        `<!--[-->` +
          `<div>foo</div>` +
          `<!--teleport start-->` +
          `<span>foo</span>` +
          `<span class="foo"></span>` +
          `<!--teleport end-->` +
          `<div class="foo2">bar</div>` +
          `<!--]-->`,
      )

      // event handler
      triggerEvent('click', container.querySelector('.foo')!)
      expect(data.value.fn1).toHaveBeenCalled()

      triggerEvent('click', container.querySelector('.foo2')!)
      expect(data.value.fn2).toHaveBeenCalled()

      data.value.msg = 'bar'
      await nextTick()
      expect(container.innerHTML).toBe(
        `<!--[-->` +
          `<div>foo</div>` +
          `<!--teleport start-->` +
          `<span>bar</span>` +
          `<span class="bar"></span>` +
          `<!--teleport end-->` +
          `<div class="bar2">bar</div>` +
          `<!--]-->`,
      )
    })

    test('disabled + as component root', async () => {
      const { container } = await mountWithHydration(
        `<!--[-->` +
          `<div>Parent fragment</div>` +
          `<!--teleport start--><div>Teleport content</div><!--teleport end-->` +
          `<!--]-->`,
        `
          <div>Parent fragment</div>
          <teleport to="body" disabled>
            <div>Teleport content</div>
          </teleport>
        `,
      )
      expect(container.innerHTML).toBe(
        `<!--[-->` +
          `<div>Parent fragment</div>` +
          `<!--teleport start-->` +
          `<div>Teleport content</div>` +
          `<!--teleport end-->` +
          `<!--]-->`,
      )
      expect(`mismatch`).not.toHaveBeenWarned()
    })

    test('as component root', async () => {
      const teleportContainer = document.createElement('div')
      teleportContainer.id = 'teleport4'
      teleportContainer.innerHTML = `<!--teleport start anchor-->hello<!--teleport anchor-->`
      document.body.appendChild(teleportContainer)

      const { block, container } = await mountWithHydration(
        '<!--teleport start--><!--teleport end-->',
        `<components.Wrapper></components.Wrapper>`,
        undefined,
        {
          Wrapper: compileVaporComponent(
            `<teleport to="#teleport4">hello</teleport>`,
          ),
        },
      )

      const teleport = (block as VaporComponentInstance)
        .block as TeleportFragment
      expect(teleport.anchor).toBe(container.childNodes[1])
      expect(teleport.target).toBe(teleportContainer)
      expect(teleport.targetStart).toBe(teleportContainer.childNodes[0])
      expect(teleport.nodes).toBe(teleportContainer.childNodes[1])
      expect(teleport.targetAnchor).toBe(teleportContainer.childNodes[2])
    })

    test('nested', async () => {
      const teleportContainer = document.createElement('div')
      teleportContainer.id = 'teleport5'
      teleportContainer.innerHTML =
        `<!--teleport start anchor-->` +
        `<!--teleport start--><!--teleport end-->` +
        `<!--teleport anchor-->` +
        `<!--teleport start anchor-->` +
        `<div>child</div>` +
        `<!--teleport anchor-->`
      document.body.appendChild(teleportContainer)

      const { block, container } = await mountWithHydration(
        '<!--teleport start--><!--teleport end-->',
        `<teleport to="#teleport5">
          <teleport to="#teleport5"><div>child</div></teleport>
        </teleport>`,
      )

      const teleport = block as TeleportFragment
      expect(teleport.anchor).toBe(container.childNodes[1])
      expect(teleport.targetStart).toBe(teleportContainer.childNodes[0])
      expect(teleport.targetAnchor).toBe(teleportContainer.childNodes[3])

      const childTeleport = teleport.nodes as TeleportFragment
      expect(childTeleport.anchor).toBe(teleportContainer.childNodes[2])
      expect(childTeleport.targetStart).toBe(teleportContainer.childNodes[4])
      expect(childTeleport.targetAnchor).toBe(teleportContainer.childNodes[6])
      expect(childTeleport.nodes).toBe(teleportContainer.childNodes[5])
    })

    test('unmount (full integration)', async () => {
      const targetId = 'teleport6'
      const data = ref({
        toggle: ref(true),
      })

      const template1 = `<Teleport to="#${targetId}"><span>Teleported Comp1</span></Teleport>`
      const Comp1 = compileVaporComponent(template1)
      const SSRComp1 = compileVaporComponent(
        template1,
        undefined,
        undefined,
        true,
      )

      const template2 = `<div>Comp2</div>`
      const Comp2 = compileVaporComponent(template2)
      const SSRComp2 = compileVaporComponent(
        template2,
        undefined,
        undefined,
        true,
      )

      const appCode = `
        <div>
          <components.Comp1 v-if="data.toggle"/>
          <components.Comp2 v-else/>
        </div>
      `

      const SSRApp = compileVaporComponent(
        appCode,
        data,
        {
          Comp1: SSRComp1,
          Comp2: SSRComp2,
        },
        true,
      )

      const teleportContainer = document.createElement('div')
      teleportContainer.id = targetId
      document.body.appendChild(teleportContainer)

      const ctx = {} as any
      const mainHtml = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRApp),
        ctx,
      )
      expect(mainHtml).toBe(
        '<div><!--teleport start--><!--teleport end--></div>',
      )
      teleportContainer.innerHTML = ctx.teleports![`#${targetId}`]

      const { container } = await mountWithHydration(mainHtml, appCode, data, {
        Comp1,
        Comp2,
      })

      expect(container.innerHTML).toBe(
        '<div><!--teleport start--><!--teleport end--><!--if--></div>',
      )
      expect(teleportContainer.innerHTML).toBe(
        `<!--teleport start anchor-->` +
          `<span>Teleported Comp1</span>` +
          `<!--teleport anchor-->`,
      )
      expect(`mismatch`).not.toHaveBeenWarned()

      data.value.toggle = false
      await nextTick()
      expect(container.innerHTML).toBe('<div><div>Comp2</div><!--if--></div>')
      expect(teleportContainer.innerHTML).toBe('')
    })

    test('unmount (mismatch + full integration)', async () => {
      const targetId = 'teleport7'
      const data = ref({
        toggle: ref(true),
      })

      const template1 = `<Teleport to="#${targetId}"><span>Teleported Comp1</span></Teleport>`
      const Comp1 = compileVaporComponent(template1)
      const SSRComp1 = compileVaporComponent(
        template1,
        undefined,
        undefined,
        true,
      )

      const template2 = `<div>Comp2</div>`
      const Comp2 = compileVaporComponent(template2)
      const SSRComp2 = compileVaporComponent(
        template2,
        undefined,
        undefined,
        true,
      )

      const appCode = `
        <div>
          <components.Comp1 v-if="data.toggle"/>
          <components.Comp2 v-else/>
        </div>
      `

      const SSRApp = compileVaporComponent(
        appCode,
        data,
        {
          Comp1: SSRComp1,
          Comp2: SSRComp2,
        },
        true,
      )

      const teleportContainer = document.createElement('div')
      teleportContainer.id = targetId
      document.body.appendChild(teleportContainer)

      const mainHtml = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRApp),
      )
      expect(mainHtml).toBe(
        '<div><!--teleport start--><!--teleport end--></div>',
      )
      expect(teleportContainer.innerHTML).toBe('')

      const { container } = await mountWithHydration(mainHtml, appCode, data, {
        Comp1,
        Comp2,
      })

      expect(container.innerHTML).toBe(
        '<div><!--teleport start--><!--teleport end--><!--if--></div>',
      )
      expect(teleportContainer.innerHTML).toBe(`<span>Teleported Comp1</span>`)
      expect(`Hydration children mismatch`).toHaveBeenWarned()

      data.value.toggle = false
      await nextTick()
      expect(container.innerHTML).toBe('<div><div>Comp2</div><!--if--></div>')
      expect(teleportContainer.innerHTML).toBe('')
    })

    test('target change (mismatch + full integration)', async () => {
      const targetId1 = 'teleport8-1'
      const targetId2 = 'teleport8-2'
      const data = ref({
        target: ref(targetId1),
        msg: ref('foo'),
      })

      const template = `<Teleport :to="'#' + data.target"><span>{{data.msg}}</span></Teleport>`
      const Comp = compileVaporComponent(template, data)
      const SSRComp = compileVaporComponent(template, data, undefined, true)

      const teleportContainer1 = document.createElement('div')
      teleportContainer1.id = targetId1
      const teleportContainer2 = document.createElement('div')
      teleportContainer2.id = targetId2
      document.body.appendChild(teleportContainer1)
      document.body.appendChild(teleportContainer2)

      // server render
      const mainHtml = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRComp),
      )
      expect(mainHtml).toBe(`<!--teleport start--><!--teleport end-->`)
      expect(teleportContainer1.innerHTML).toBe('')
      expect(teleportContainer2.innerHTML).toBe('')

      // hydrate
      const { container } = await mountWithHydration(mainHtml, template, data, {
        Comp,
      })

      expect(container.innerHTML).toBe(
        `<!--teleport start--><!--teleport end-->`,
      )
      expect(teleportContainer1.innerHTML).toBe(`<span>foo</span>`)
      expect(teleportContainer2.innerHTML).toBe('')
      expect(`Hydration children mismatch`).toHaveBeenWarned()

      data.value.target = targetId2
      data.value.msg = 'bar'
      await nextTick()
      expect(container.innerHTML).toBe(
        `<!--teleport start--><!--teleport end-->`,
      )
      expect(teleportContainer1.innerHTML).toBe('')
      expect(teleportContainer2.innerHTML).toBe(`<span>bar</span>`)
    })

    test('with disabled teleport + undefined target', async () => {
      const data = ref({
        msg: ref('foo'),
      })

      const { container } = await mountWithHydration(
        '<!--teleport start--><span>foo</span><!--teleport end-->',
        `<teleport :to="undefined" :disabled="true">
          <span>{{data.msg}}</span>
        </teleport>`,
        data,
      )

      expect(container.innerHTML).toBe(
        `<!--teleport start--><span>foo</span><!--teleport end-->`,
      )

      data.value.msg = 'bar'
      await nextTick()
      expect(container.innerHTML).toBe(
        `<!--teleport start--><span>bar</span><!--teleport end-->`,
      )
    })
  })

  describe('async component', async () => {
    test('async component', async () => {
      const data = ref({
        spy: vi.fn(),
      })

      const compCode = `<button @click="data.spy">hello!</button>`
      const SSRComp = compileVaporComponent(compCode, data, undefined, true)
      let serverResolve: any
      // use defineAsyncComponent in SSR
      let AsyncComp = defineAsyncComponent(
        () =>
          new Promise(r => {
            serverResolve = r
          }),
      )
      const appCode = `hello<components.AsyncComp/>world`
      const SSRApp = compileVaporComponent(appCode, data, { AsyncComp }, true)

      // server render
      const htmlPromise = VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRApp),
      )
      serverResolve(SSRComp)
      const html = await htmlPromise
      expect(html).toMatchInlineSnapshot(
        `"<!--[-->hello<button>hello!</button>world<!--]-->"`,
      )

      // hydration
      let clientResolve: any
      AsyncComp = defineVaporAsyncComponent(
        () =>
          new Promise(r => {
            clientResolve = r
          }),
      ) as any

      const Comp = compileVaporComponent(compCode, data)
      const App = compileVaporComponent(appCode, data, { AsyncComp })

      const container = document.createElement('div')
      container.innerHTML = html
      document.body.appendChild(container)
      createVaporSSRApp(App).mount(container)

      // hydration not complete yet
      triggerEvent('click', container.querySelector('button')!)
      expect(data.value.spy).not.toHaveBeenCalled()

      // resolve
      clientResolve(Comp)
      await new Promise(r => setTimeout(r))

      // should be hydrated now
      triggerEvent('click', container.querySelector('button')!)
      expect(data.value.spy).toHaveBeenCalled()
    })

    // No longer needed, parent component updates in vapor mode no longer
    // cause child components to re-render
    // test.todo('update async wrapper before resolve', async () => {})

    test('update async component after parent mount before async component resolve', async () => {
      const data = ref({
        toggle: true,
      })
      const compCode = `
          <script vapor>
            defineProps(['toggle'])
          </script>
          <template>
            <h1>{{ toggle ? 'Async component' : 'Updated async component' }}</h1>
          </template>
        `
      const SSRComp = compileVaporComponent(
        compCode,
        undefined,
        undefined,
        true,
      )
      let serverResolve: any
      // use defineAsyncComponent in SSR
      let AsyncComp = defineAsyncComponent(
        () =>
          new Promise(r => {
            serverResolve = r
          }),
      )
      const appCode = `<components.AsyncComp :toggle="data.toggle"/>`
      const SSRApp = compileVaporComponent(appCode, data, { AsyncComp }, true)

      // server render
      const htmlPromise = VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRApp),
      )
      serverResolve(SSRComp)
      const html = await htmlPromise
      expect(html).toMatchInlineSnapshot(`"<h1>Async component</h1>"`)

      // hydration
      let clientResolve: any
      AsyncComp = defineVaporAsyncComponent(
        () =>
          new Promise(r => {
            clientResolve = r
          }),
      ) as any

      const Comp = compileVaporComponent(compCode)
      const App = compileVaporComponent(appCode, data, { AsyncComp })

      const container = document.createElement('div')
      container.innerHTML = html
      document.body.appendChild(container)
      createVaporSSRApp(App).mount(container)

      // update before resolve
      data.value.toggle = false
      await nextTick()

      // resolve
      clientResolve(Comp)
      await new Promise(r => setTimeout(r))

      // prevent lazy hydration since the component has been patched
      expect('Skipping lazy hydration for component').toHaveBeenWarned()
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
      expect(container.innerHTML).toMatchInlineSnapshot(
        `"<h1>Updated async component</h1><!--async component-->"`,
      )
    })

    test('update async component (fragment root) after parent mount before async component resolve', async () => {
      const data = ref({
        toggle: true,
      })
      const compCode = `
          <script vapor>
            defineProps(['toggle'])
          </script>
          <template>
            <h1>{{ toggle ? 'Async component' : 'Updated async component' }}</h1>
            <h2>fragment root</h2>
          </template>
        `
      const SSRComp = compileVaporComponent(
        compCode,
        undefined,
        undefined,
        true,
      )
      let serverResolve: any
      // use defineAsyncComponent in SSR
      let AsyncComp = defineAsyncComponent(
        () =>
          new Promise(r => {
            serverResolve = r
          }),
      )
      const appCode = `<components.AsyncComp :toggle="data.toggle"/>`
      const SSRApp = compileVaporComponent(appCode, data, { AsyncComp }, true)

      // server render
      const htmlPromise = VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRApp),
      )
      serverResolve(SSRComp)
      const html = await htmlPromise
      expect(html).toMatchInlineSnapshot(
        `"<!--[--><h1>Async component</h1><h2>fragment root</h2><!--]-->"`,
      )

      // hydration
      let clientResolve: any
      AsyncComp = defineVaporAsyncComponent(
        () =>
          new Promise(r => {
            clientResolve = r
          }),
      ) as any

      const Comp = compileVaporComponent(compCode)
      const App = compileVaporComponent(appCode, data, { AsyncComp })

      const container = document.createElement('div')
      container.innerHTML = html
      document.body.appendChild(container)
      createVaporSSRApp(App).mount(container)

      // update before resolve
      data.value.toggle = false
      await nextTick()

      // resolve
      clientResolve(Comp)
      await new Promise(r => setTimeout(r))

      // prevent lazy hydration since the component has been patched
      expect('Skipping lazy hydration for component').toHaveBeenWarned()
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
      expect(container.innerHTML).toMatchInlineSnapshot(
        `"<!--[--><h1>Updated async component</h1><h2>fragment root</h2><!--async component--><!--]-->"`,
      )
    })

    // required vapor Suspense
    test.todo(
      'hydrate safely when property used by async setup changed before render',
      async () => {},
    )

    // required vapor Suspense
    test.todo(
      'hydrate safely when property used by deep nested async setup changed before render',
      async () => {},
    )

    test('unmount async wrapper before load', async () => {
      const data = ref({
        toggle: true,
      })
      const compCode = `<div>async</div>`
      const appCode = `
        <div>
          <components.AsyncComp v-if="data.toggle"/>
          <div v-else>hi</div>
        </div>
      `

      // hydration
      let clientResolve: any
      const AsyncComp = defineVaporAsyncComponent(
        () =>
          new Promise(r => {
            clientResolve = r
          }),
      )

      const Comp = compileVaporComponent(compCode)
      const App = compileVaporComponent(appCode, data, {
        AsyncComp,
      })

      const container = document.createElement('div')
      container.innerHTML = '<div><div>async</div></div>'
      createVaporSSRApp(App).mount(container)

      // unmount before resolve
      data.value.toggle = false
      await nextTick()
      expect(container.innerHTML).toBe(`<div><div>hi</div><!--if--></div>`)

      // resolve
      clientResolve(Comp)
      await new Promise(r => setTimeout(r))
      // should remain unmounted
      expect(container.innerHTML).toBe(`<div><div>hi</div><!--if--></div>`)
    })

    test('unmount async wrapper before load (fragment)', async () => {
      const data = ref({
        toggle: true,
      })
      const compCode = `<div>async</div><div>fragment</div>`
      const appCode = `
        <div>
          <components.AsyncComp v-if="data.toggle"/>
          <div v-else>hi</div>
        </div>
      `

      // hydration
      let clientResolve: any
      const AsyncComp = defineVaporAsyncComponent(
        () =>
          new Promise(r => {
            clientResolve = r
          }),
      )

      const Comp = compileVaporComponent(compCode)
      const App = compileVaporComponent(appCode, data, {
        AsyncComp,
      })

      const container = document.createElement('div')
      container.innerHTML =
        '<div><!--[--><div>async</div><div>fragment</div><!--]--></div>'
      createVaporSSRApp(App).mount(container)

      // unmount before resolve
      data.value.toggle = false
      await nextTick()
      expect(container.innerHTML).toBe(`<div><div>hi</div><!--if--></div>`)

      // resolve
      clientResolve(Comp)
      await new Promise(r => setTimeout(r))
      // should remain unmounted
      expect(container.innerHTML).toBe(`<div><div>hi</div><!--if--></div>`)
    })

    test('nested async wrapper', async () => {
      const toggleCode = `
      <script vapor>
        import { onMounted, ref, nextTick } from 'vue'
        const show = ref(false)
        onMounted(() => {
          nextTick(() => {
            show.value = true
          })
        })
      </script>
      <template>
        <div v-show="show">
          <slot />
        </div>
      </template>
      `

      const SSRToggle = compileVaporComponent(
        toggleCode,
        undefined,
        undefined,
        true,
      )

      const wrapperCode = `<slot/>`
      const SSRWrapper = compileVaporComponent(
        wrapperCode,
        undefined,
        undefined,
        true,
      )

      const data = ref({
        count: 0,
        fn: vi.fn(),
      })

      const childCode = `
        <script vapor>
          import { onMounted } from 'vue'
          const data = _data; const components = _components;
          onMounted(() => {
            data.value.fn()
            data.value.count++
          })
        </script>
        <template>
          <div>{{data.count}}</div>
        </template>
      `

      const SSRChild = compileVaporComponent(childCode, data, undefined, true)

      const appCode = `
      <components.Toggle>
        <components.Wrapper>
          <components.Wrapper>
            <components.Child/>
          </components.Wrapper>
        </components.Wrapper>
      </components.Toggle>
      `

      const SSRApp = compileVaporComponent(
        appCode,
        undefined,
        {
          Toggle: SSRToggle,
          Wrapper: SSRWrapper,
          Child: SSRChild,
        },
        true,
      )

      const root = document.createElement('div')

      // server render
      root.innerHTML = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRApp),
      )
      expect(root.innerHTML).toMatchInlineSnapshot(
        `"<div style="display:none;"><!--[--><!--[--><!--[--><div>0</div><!--]--><!--]--><!--]--></div>"`,
      )

      const Toggle = compileVaporComponent(toggleCode)
      const Wrapper = compileVaporComponent(wrapperCode)
      const Child = compileVaporComponent(childCode, data)

      const App = compileVaporComponent(appCode, undefined, {
        Toggle,
        Wrapper,
        Child,
      })

      // hydration
      createVaporSSRApp(App).mount(root)
      await nextTick()
      await nextTick()
      expect(root.innerHTML).toMatchInlineSnapshot(
        `"<div style=""><!--[--><!--[--><!--[--><div>1</div><!--]--><!--]--><!--]--></div>"`,
      )
      expect(data.value.fn).toBeCalledTimes(1)
    })
  })

  describe.todo('Suspense')

  describe('force hydrate prop', async () => {
    test('force hydrate prop with `.prop` modifier', async () => {
      const { container } = await mountWithHydration(
        '<input type="checkbox">',
        `<input type="checkbox" .indeterminate="true"/>`,
      )
      expect((container.firstChild! as any).indeterminate).toBe(true)
    })

    test('force hydrate input v-model with non-string value bindings', async () => {
      const { container } = await mountWithHydration(
        '<input type="checkbox" value="true">',
        `<input type="checkbox" :true-value="true"/>`,
      )
      expect((container.firstChild as any)._trueValue).toBe(true)
    })

    test('force hydrate checkbox with indeterminate', async () => {
      const { container } = await mountWithHydration(
        '<input type="checkbox" indeterminate/>',
        `<input type="checkbox" :indeterminate="true"/>`,
      )
      expect((container.firstChild! as any).indeterminate).toBe(true)
    })

    test('force hydrate select option with non-string value bindings', async () => {
      const { container } = await mountWithHydration(
        '<select><option value="true">ok</option></select>',
        `<select><option :value="true">ok</option></select>`,
      )
      expect((container.firstChild!.firstChild as any)._value).toBe(true)
    })

    test('force hydrate v-bind with .prop modifiers', async () => {
      const { container } = await mountWithHydration(
        '<div .foo="true"/>',
        `<div v-bind="data"/>`,
        ref({ '.foo': true }),
      )
      expect((container.firstChild! as any).foo).toBe(true)
    })

    // vapor custom element not implemented yet
    test.todo('force hydrate custom element with dynamic props', () => {})
  })
})

describe('mismatch handling', () => {
  test('text node', async () => {
    const foo = ref('bar')
    const { container } = await mountWithHydration(`foo`, `{{data}}`, foo)
    expect(container.textContent).toBe('bar')
    expect(`Hydration text mismatch`).toHaveBeenWarned()
  })

  test('element text content', async () => {
    const data = ref({ textContent: 'bar' })
    const { container } = await mountWithHydration(
      `<div>foo</div>`,
      `<div v-bind="data"></div>`,
      data,
    )
    expect(container.innerHTML).toBe('<div>bar</div>')
    expect(`Hydration text content mismatch`).toHaveBeenWarned()
  })

  // test('not enough children', () => {
  //   const { container } = mountWithHydration(`<div></div>`, () =>
  //     h('div', [h('span', 'foo'), h('span', 'bar')]),
  //   )
  //   expect(container.innerHTML).toBe(
  //     '<div><span>foo</span><span>bar</span></div>',
  //   )
  //   expect(`Hydration children mismatch`).toHaveBeenWarned()
  // })
  // test('too many children', () => {
  //   const { container } = mountWithHydration(
  //     `<div><span>foo</span><span>bar</span></div>`,
  //     () => h('div', [h('span', 'foo')]),
  //   )
  //   expect(container.innerHTML).toBe('<div><span>foo</span></div>')
  //   expect(`Hydration children mismatch`).toHaveBeenWarned()
  // })
  test('complete mismatch', async () => {
    const data = ref('span')
    const { container } = await mountWithHydration(
      `<div>foo</div>`,
      `<component :is="data">foo</component>`,
      data,
    )
    expect(container.innerHTML).toBe('<span>foo</span><!--dynamic-component-->')
    expect(`Hydration node mismatch`).toHaveBeenWarned()
  })
  // test('fragment mismatch removal', () => {
  //   const { container } = mountWithHydration(
  //     `<div><!--[--><div>foo</div><div>bar</div><!--]--></div>`,
  //     () => h('div', [h('span', 'replaced')]),
  //   )
  //   expect(container.innerHTML).toBe('<div><span>replaced</span></div>')
  //   expect(`Hydration node mismatch`).toHaveBeenWarned()
  // })
  // test('fragment not enough children', () => {
  //   const { container } = mountWithHydration(
  //     `<div><!--[--><div>foo</div><!--]--><div>baz</div></div>`,
  //     () => h('div', [[h('div', 'foo'), h('div', 'bar')], h('div', 'baz')]),
  //   )
  //   expect(container.innerHTML).toBe(
  //     '<div><!--[--><div>foo</div><div>bar</div><!--]--><div>baz</div></div>',
  //   )
  //   expect(`Hydration node mismatch`).toHaveBeenWarned()
  // })
  // test('fragment too many children', () => {
  //   const { container } = mountWithHydration(
  //     `<div><!--[--><div>foo</div><div>bar</div><!--]--><div>baz</div></div>`,
  //     () => h('div', [[h('div', 'foo')], h('div', 'baz')]),
  //   )
  //   expect(container.innerHTML).toBe(
  //     '<div><!--[--><div>foo</div><!--]--><div>baz</div></div>',
  //   )
  //   // fragment ends early and attempts to hydrate the extra <div>bar</div>
  //   // as 2nd fragment child.
  //   expect(`Hydration text content mismatch`).toHaveBeenWarned()
  //   // excessive children removal
  //   expect(`Hydration children mismatch`).toHaveBeenWarned()
  // })
  // test('Teleport target has empty children', () => {
  //   const teleportContainer = document.createElement('div')
  //   teleportContainer.id = 'teleport'
  //   document.body.appendChild(teleportContainer)
  //   mountWithHydration('<!--teleport start--><!--teleport end-->', () =>
  //     h(Teleport, { to: '#teleport' }, [h('span', 'value')]),
  //   )
  //   expect(teleportContainer.innerHTML).toBe(`<span>value</span>`)
  //   expect(`Hydration children mismatch`).toHaveBeenWarned()
  // })
  // test('comment mismatch (element)', () => {
  //   const { container } = mountWithHydration(`<div><span></span></div>`, () =>
  //     h('div', [createCommentVNode('hi')]),
  //   )
  //   expect(container.innerHTML).toBe('<div><!--hi--></div>')
  //   expect(`Hydration node mismatch`).toHaveBeenWarned()
  // })
  // test('comment mismatch (text)', () => {
  //   const { container } = mountWithHydration(`<div>foobar</div>`, () =>
  //     h('div', [createCommentVNode('hi')]),
  //   )
  //   expect(container.innerHTML).toBe('<div><!--hi--></div>')
  //   expect(`Hydration node mismatch`).toHaveBeenWarned()
  // })
  test('class mismatch', async () => {
    await mountWithHydration(
      `<div class="foo bar"></div>`,
      `<div :class="data"></div>`,
      ref(['foo', 'bar']),
    )

    await mountWithHydration(
      `<div class="foo bar"></div>`,
      `<div :class="data"></div>`,
      ref({ foo: true, bar: true }),
    )

    await mountWithHydration(
      `<div class="foo bar"></div>`,
      `<div :class="data"></div>`,
      ref('foo bar'),
    )

    // svg classes
    await mountWithHydration(
      `<svg class="foo bar"></svg>`,
      `<svg :class="data"></svg>`,
      ref('foo bar'),
    )

    // class with different order
    await mountWithHydration(
      `<div class="foo bar"></div>`,
      `<div :class="data"></div>`,
      ref('bar foo'),
    )
    expect(`Hydration class mismatch`).not.toHaveBeenWarned()

    // single root mismatch
    const { container: root } = await mountWithHydration(
      `<div class="foo bar"></div>`,
      `<div :class="data"></div>`,
      ref('baz'),
    )
    expect(root.innerHTML).toBe('<div class="foo bar baz"></div>')
    expect(`Hydration class mismatch`).toHaveBeenWarned()

    // multiple root mismatch
    const { container } = await mountWithHydration(
      `<div class="foo bar"></div><span/>`,
      `<div :class="data"></div><span/>`,
      ref('foo'),
    )
    expect(container.innerHTML).toBe('<div class="foo"></div><span></span>')
    expect(`Hydration class mismatch`).toHaveBeenWarned()
  })

  test('style mismatch', async () => {
    await mountWithHydration(
      `<div style="color:red;"></div>`,
      `<div :style="data"></div>`,
      ref({ color: 'red' }),
    )

    await mountWithHydration(
      `<div style="color:red;"></div>`,
      `<div :style="data"></div>`,
      ref('color:red;'),
    )

    // style with different order
    await mountWithHydration(
      `<div style="color:red; font-size: 12px;"></div>`,
      `<div :style="data"></div>`,
      ref(`font-size: 12px; color:red;`),
    )

    expect(`Hydration style mismatch`).not.toHaveBeenWarned()

    // single root mismatch
    const { container: root } = await mountWithHydration(
      `<div style="color:red;"></div>`,
      `<div :style="data"></div>`,
      ref({ color: 'green' }),
    )
    expect(root.innerHTML).toBe('<div style="color: green;"></div>')
    expect(`Hydration style mismatch`).toHaveBeenWarned()

    // multiple root mismatch
    const { container } = await mountWithHydration(
      `<div style="color:red;"></div><span/>`,
      `<div :style="data"></div><span/>`,
      ref({ color: 'green' }),
    )
    expect(container.innerHTML).toBe(
      '<div style="color: green;"></div><span></span>',
    )
    expect(`Hydration style mismatch`).toHaveBeenWarned()
  })

  test('style mismatch when no style attribute is present', async () => {
    await mountWithHydration(
      `<div></div>`,
      `<div :style="data"></div>`,
      ref({ color: 'red' }),
    )
    expect(`Hydration style mismatch`).toHaveBeenWarnedTimes(1)
  })

  test('style mismatch w/ v-show', async () => {
    await mountWithHydration(
      `<div style="color:red;display:none"></div>`,
      `<div v-show="data" style="color: red;"></div>`,
      ref(false),
    )
    expect(`Hydration style mismatch`).not.toHaveBeenWarned()

    // mismatch with single root
    const { container: root } = await mountWithHydration(
      `<div style="color:red;"></div>`,
      `<div v-show="data" style="color: red;"></div>`,
      ref(false),
    )
    expect(root.innerHTML).toBe(
      '<div style="color: red; display: none;"></div>',
    )
    expect(`Hydration style mismatch`).toHaveBeenWarned()

    // mismatch with multiple root
    const { container } = await mountWithHydration(
      `<div style="color:red;"></div><span/>`,
      `<div v-show="data.show" :style="data.style"></div><span/>`,
      ref({ show: false, style: 'color: red' }),
    )
    expect(container.innerHTML).toBe(
      '<div style="color: red; display: none;"></div><span></span>',
    )
    expect(`Hydration style mismatch`).toHaveBeenWarned()
  })

  test('attr mismatch', async () => {
    await mountWithHydration(
      `<div id="foo"></div>`,
      `<div :id="data"></div>`,
      ref('foo'),
    )

    await mountWithHydration(
      `<div spellcheck></div>`,
      `<div :spellcheck="data"></div>`,
      ref(''),
    )

    await mountWithHydration(
      `<div></div>`,
      `<div :id="data"></div>`,
      ref(undefined),
    )

    // boolean
    await mountWithHydration(
      `<select multiple></div>`,
      `<select :multiple="data"></select>`,
      ref(true),
    )

    await mountWithHydration(
      `<select multiple></div>`,
      `<select :multiple="data"></select>`,
      ref('multiple'),
    )

    expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
    await mountWithHydration(
      `<div></div>`,
      `<div :id="data"></div>`,
      ref('foo'),
    )
    expect(`Hydration attribute mismatch`).toHaveBeenWarnedTimes(1)

    await mountWithHydration(
      `<div id="bar"></div>`,
      `<div :id="data"></div>`,
      ref('foo'),
    )
    expect(`Hydration attribute mismatch`).toHaveBeenWarnedTimes(2)
  })

  test('attr special case: textarea value', async () => {
    await mountWithHydration(
      `<textarea>foo</textarea>`,
      `<textarea :value="data"></textarea>`,
      ref('foo'),
    )

    await mountWithHydration(
      `<textarea></textarea>`,
      `<textarea :value="data"></textarea>`,
      ref(''),
    )
    expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()

    await mountWithHydration(
      `<textarea>foo</textarea>`,
      `<textarea :value="data"></textarea>`,
      ref('bar'),
    )
    expect(`Hydration attribute mismatch`).toHaveBeenWarned()
  })

  test('<textarea> with newlines at the beginning', async () => {
    await mountWithHydration(
      `<textarea>\nhello</textarea>`,
      `<textarea :value="data"></textarea>`,
      ref('\nhello'),
    )

    await mountWithHydration(
      `<textarea>\nhello</textarea>`,
      `<textarea v-text="data"></textarea>`,
      ref('\nhello'),
    )

    await mountWithHydration(
      `<textarea>\nhello</textarea>`,
      `<textarea v-bind="data"></textarea>`,
      ref({ textContent: '\nhello' }),
    )
    expect(`Hydration text content mismatch`).not.toHaveBeenWarned()
  })

  test('<pre> with newlines at the beginning', async () => {
    await mountWithHydration(`<pre>\n</pre>`, `<pre>{{data}}</pre>`, ref('\n'))

    await mountWithHydration(
      `<pre>\n</pre>`,
      `<pre v-text="data"></pre>`,
      ref('\n'),
    )

    await mountWithHydration(
      `<pre>\n</pre>`,
      `<pre v-bind="data"></pre>`,
      ref({ textContent: '\n' }),
    )
    expect(`Hydration text content mismatch`).not.toHaveBeenWarned()
  })

  test('boolean attr handling', async () => {
    await mountWithHydration(
      `<input />`,
      `<input :readonly="data" />`,
      ref(false),
    )

    await mountWithHydration(
      `<input readonly />`,
      `<input :readonly="data" />`,
      ref(true),
    )

    await mountWithHydration(
      `<input readonly="readonly" />`,
      `<input :readonly="data" />`,
      ref(true),
    )
    expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
  })

  test('client value is null or undefined', async () => {
    await mountWithHydration(
      `<div></div>`,
      `<div :draggable="data"></div>`,
      ref(undefined),
    )
    expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
    await mountWithHydration(`<input />`, `<input :type="data" />`, ref(null))
    expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
  })

  test('should not warn against object values', async () => {
    await mountWithHydration(`<input />`, `<input :from="data" />`, ref({}))
    expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
  })

  test('should not warn on falsy bindings of non-property keys', async () => {
    await mountWithHydration(
      `<button></button>`,
      `<button :href="data"></button>`,
      ref(undefined),
    )
    expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
  })

  test('should not warn on non-renderable option values', async () => {
    await mountWithHydration(
      `<select><option>hello</option></select>`,
      `<select><option :value="data">hello</option></select>`,
      ref(['foo']),
    )
    expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
  })

  test.todo('should not warn css v-bind', () => {
    // const container = document.createElement('div')
    // container.innerHTML = `<div style="--foo:red;color:var(--foo);" />`
    // const app = createSSRApp({
    //   setup() {
    //     useCssVars(() => ({
    //       foo: 'red',
    //     }))
    //     return () => h('div', { style: { color: 'var(--foo)' } })
    //   },
    // })
    // app.mount(container)
    // expect(`Hydration style mismatch`).not.toHaveBeenWarned()
  })

  test.todo(
    'css vars should only be added to expected on component root dom',
    () => {
      // const container = document.createElement('div')
      // container.innerHTML = `<div style="--foo:red;"><div style="color:var(--foo);" /></div>`
      // const app = createSSRApp({
      //   setup() {
      //     useCssVars(() => ({
      //       foo: 'red',
      //     }))
      //     return () =>
      //       h('div', null, [h('div', { style: { color: 'var(--foo)' } })])
      //   },
      // })
      // app.mount(container)
      // expect(`Hydration style mismatch`).not.toHaveBeenWarned()
    },
  )

  test.todo('css vars support fallthrough', () => {
    // const container = document.createElement('div')
    // container.innerHTML = `<div style="padding: 4px;--foo:red;"></div>`
    // const app = createSSRApp({
    //   setup() {
    //     useCssVars(() => ({
    //       foo: 'red',
    //     }))
    //     return () => h(Child)
    //   },
    // })
    // const Child = {
    //   setup() {
    //     return () => h('div', { style: 'padding: 4px' })
    //   },
    // }
    // app.mount(container)
    // expect(`Hydration style mismatch`).not.toHaveBeenWarned()
  })

  // vapor directive does not have a created hook
  test('should not warn for directives that mutate DOM in created', () => {
    // const container = document.createElement('div')
    // container.innerHTML = `<div class="test red"></div>`
    // const vColor: ObjectDirective = {
    //   created(el, binding) {
    //     el.classList.add(binding.value)
    //   },
    // }
    // const app = createSSRApp({
    //   setup() {
    //     return () =>
    //       withDirectives(h('div', { class: 'test' }), [[vColor, 'red']])
    //   },
    // })
    // app.mount(container)
    // expect(`Hydration style mismatch`).not.toHaveBeenWarned()
  })

  test.todo('escape css var name', () => {
    // const container = document.createElement('div')
    // container.innerHTML = `<div style="padding: 4px;--foo\\.bar:red;"></div>`
    // const app = createSSRApp({
    //   setup() {
    //     useCssVars(() => ({
    //       'foo.bar': 'red',
    //     }))
    //     return () => h(Child)
    //   },
    // })
    // const Child = {
    //   setup() {
    //     return () => h('div', { style: 'padding: 4px' })
    //   },
    // }
    // app.mount(container)
    // expect(`Hydration style mismatch`).not.toHaveBeenWarned()
  })
})

describe('data-allow-mismatch', () => {
  test('element text content', async () => {
    const data = ref({ textContent: 'bar' })
    const { container } = await mountWithHydration(
      `<div data-allow-mismatch="text">foo</div>`,
      `<div v-bind="data"></div>`,
      data,
    )
    expect(container.innerHTML).toBe(
      '<div data-allow-mismatch="text">bar</div>',
    )
    expect(`Hydration text content mismatch`).not.toHaveBeenWarned()
  })
  // test('not enough children', () => {
  //   const { container } = mountWithHydration(
  //     `<div data-allow-mismatch="children"></div>`,
  //     () => h('div', [h('span', 'foo'), h('span', 'bar')]),
  //   )
  //   expect(container.innerHTML).toBe(
  //     '<div data-allow-mismatch="children"><span>foo</span><span>bar</span></div>',
  //   )
  //   expect(`Hydration children mismatch`).not.toHaveBeenWarned()
  // })
  // test('too many children', () => {
  //   const { container } = mountWithHydration(
  //     `<div data-allow-mismatch="children"><span>foo</span><span>bar</span></div>`,
  //     () => h('div', [h('span', 'foo')]),
  //   )
  //   expect(container.innerHTML).toBe(
  //     '<div data-allow-mismatch="children"><span>foo</span></div>',
  //   )
  //   expect(`Hydration children mismatch`).not.toHaveBeenWarned()
  // })
  test('complete mismatch', async () => {
    const { container } = await mountWithHydration(
      `<div data-allow-mismatch="children"><div>foo</div></div>`,
      `<div><component :is="data">foo</component></div>`,
      ref('span'),
    )
    expect(container.innerHTML).toBe(
      '<div data-allow-mismatch="children"><span>foo</span><!--dynamic-component--></div>',
    )
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
  })
  // test('fragment mismatch removal', () => {
  //   const { container } = mountWithHydration(
  //     `<div data-allow-mismatch="children"><!--[--><div>foo</div><div>bar</div><!--]--></div>`,
  //     () => h('div', [h('span', 'replaced')]),
  //   )
  //   expect(container.innerHTML).toBe(
  //     '<div data-allow-mismatch="children"><span>replaced</span></div>',
  //   )
  //   expect(`Hydration node mismatch`).not.toHaveBeenWarned()
  // })
  // test('fragment not enough children', () => {
  //   const { container } = mountWithHydration(
  //     `<div data-allow-mismatch="children"><!--[--><div>foo</div><!--]--><div>baz</div></div>`,
  //     () => h('div', [[h('div', 'foo'), h('div', 'bar')], h('div', 'baz')]),
  //   )
  //   expect(container.innerHTML).toBe(
  //     '<div data-allow-mismatch="children"><!--[--><div>foo</div><div>bar</div><!--]--><div>baz</div></div>',
  //   )
  //   expect(`Hydration node mismatch`).not.toHaveBeenWarned()
  // })
  // test('fragment too many children', () => {
  //   const { container } = mountWithHydration(
  //     `<div data-allow-mismatch="children"><!--[--><div>foo</div><div>bar</div><!--]--><div>baz</div></div>`,
  //     () => h('div', [[h('div', 'foo')], h('div', 'baz')]),
  //   )
  //   expect(container.innerHTML).toBe(
  //     '<div data-allow-mismatch="children"><!--[--><div>foo</div><!--]--><div>baz</div></div>',
  //   )
  //   // fragment ends early and attempts to hydrate the extra <div>bar</div>
  //   // as 2nd fragment child.
  //   expect(`Hydration text content mismatch`).not.toHaveBeenWarned()
  //   // excessive children removal
  //   expect(`Hydration children mismatch`).not.toHaveBeenWarned()
  // })
  // test('comment mismatch (element)', () => {
  //   const { container } = mountWithHydration(
  //     `<div data-allow-mismatch="children"><span></span></div>`,
  //     () => h('div', [createCommentVNode('hi')]),
  //   )
  //   expect(container.innerHTML).toBe(
  //     '<div data-allow-mismatch="children"><!--hi--></div>',
  //   )
  //   expect(`Hydration node mismatch`).not.toHaveBeenWarned()
  // })
  // test('comment mismatch (text)', () => {
  //   const { container } = mountWithHydration(
  //     `<div data-allow-mismatch="children">foobar</div>`,
  //     () => h('div', [createCommentVNode('hi')]),
  //   )
  //   expect(container.innerHTML).toBe(
  //     '<div data-allow-mismatch="children"><!--hi--></div>',
  //   )
  //   expect(`Hydration node mismatch`).not.toHaveBeenWarned()
  // })
  test('class mismatch', async () => {
    await mountWithHydration(
      `<div class="foo bar" data-allow-mismatch="class"></div>`,
      `<div :class="data"></div>`,
      ref('foo'),
    )
    expect(`Hydration class mismatch`).not.toHaveBeenWarned()
  })

  test('style mismatch', async () => {
    await mountWithHydration(
      `<div style="color:red;" data-allow-mismatch="style"></div>`,
      `<div :style="data"></div>`,
      ref({ color: 'green' }),
    )
    expect(`Hydration style mismatch`).not.toHaveBeenWarned()
  })

  test('attr mismatch', async () => {
    await mountWithHydration(
      `<div data-allow-mismatch="attribute"></div>`,
      `<div :id="data"></div>`,
      ref('foo'),
    )

    await mountWithHydration(
      `<div id="bar" data-allow-mismatch="attribute"></div>`,
      `<div :id="data"></div>`,
      ref('foo'),
    )

    expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
  })
})

describe('VDOM interop', () => {
  test('basic render vapor component', async () => {
    const data = ref(true)
    const { container } = await testWithVDOMApp(
      `<script setup>const data = _data; const components = _components;</script>
      <template>
        <components.VaporChild/>
      </template>`,
      {
        VaporChild: {
          code: `<template>{{ data }}</template>`,
          vapor: true,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`"true"`)

    data.value = false
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`"false"`)
  })

  test('nested components (VDOM -> Vapor -> VDOM)', async () => {
    const data = ref(true)
    const { container } = await testWithVDOMApp(
      `<script setup>const data = _data; const components = _components;</script>
      <template>
        <components.VaporChild/>
      </template>`,
      {
        VaporChild: {
          code: `<template><components.VdomChild/></template>`,
          vapor: true,
        },
        VdomChild: {
          code: `<script setup>const data = _data;</script>
            <template>{{ data }}</template>`,
          vapor: false,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`"true"`)

    data.value = false
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`"false"`)
  })

  test('nested components (VDOM -> Vapor -> VDOM (with slot fallback))', async () => {
    const data = ref(true)
    const { container } = await testWithVDOMApp(
      `<script setup>const data = _data; const components = _components;</script>
      <template>
        <components.VaporChild/>
      </template>`,
      {
        VaporChild: {
          code: `<template><components.VdomChild/></template>`,
          vapor: true,
        },
        VdomChild: {
          code: `<script setup>const data = _data;</script>
            <template><slot><span>{{data}}</span></slot></template>`,
          vapor: false,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><span>true</span><!--]-->
      "
    `,
    )

    data.value = false
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><span>false</span><!--]-->
      "
    `,
    )
  })

  test('nested components (VDOM -> Vapor(with slot content) -> VDOM)', async () => {
    const data = ref(true)
    const { container } = await testWithVDOMApp(
      `<script setup>const data = _data; const components = _components;</script>
          <template>
            <components.VaporChild/>
          </template>`,
      {
        VaporChild: {
          code: `<template>
            <components.VdomChild>
              <template #default>
                <span>{{data}} vapor fallback</span>
              </template>
            </components.VdomChild>
          </template>`,
          vapor: true,
        },
        VdomChild: {
          code: `<script setup>const data = _data;</script>
            <template><slot><span>vdom fallback</span></slot></template>`,
          vapor: false,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><span>true vapor fallback</span><!--]-->
      "
    `,
    )

    data.value = false
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><span>false vapor fallback</span><!--]-->
      "
    `,
    )
  })

  test('nested components (VDOM -> Vapor(with slot content) -> Vapor)', async () => {
    const data = ref(true)
    const { container } = await testWithVDOMApp(
      `<script setup>const data = _data; const components = _components;</script>
          <template>
            <components.VaporChild/>
          </template>`,
      {
        VaporChild: {
          code: `<template>
            <components.VaporChild2>
              <template #default>
                <span>{{data}} vapor fallback</span>
              </template>
            </components.VaporChild2>
          </template>`,
          vapor: true,
        },
        VaporChild2: {
          code: `<template><slot><span>vapor fallback2</span></slot></template>`,
          vapor: true,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><span>true vapor fallback</span><!--]-->
      "
    `,
    )

    data.value = false
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><span>false vapor fallback</span><!--]-->
      "
    `,
    )
  })

  test('vapor slot render vdom component', async () => {
    const data = ref(true)
    const { container } = await testWithVDOMApp(
      `<script setup>const data = _data; const components = _components;</script>
      <template>
        <components.VaporChild>
          <components.VdomChild/>
        </components.VaporChild>
      </template>`,
      {
        VaporChild: {
          code: `<template><div><slot/></div></template>`,
          vapor: true,
        },
        VdomChild: {
          code: `<script setup>const data = _data;</script>
            <template>{{ data }}</template>`,
          vapor: false,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "<div>
      <!--[-->true<!--]-->
      </div>"
    `,
    )

    data.value = false
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "<div>
      <!--[-->false<!--]-->
      </div>"
    `,
    )
  })

  test('vapor slot render vdom component (render function)', async () => {
    const data = ref(true)
    const { container } = await testWithVaporApp(
      `<script setup>
        import { h } from 'vue'
        const data = _data; const components = _components;
        const VdomChild = {
          setup() {
            return () => h('div', null, [h('div', [String(data.value)])])
          }
        }
      </script>
      <template>
        <components.VaporChild>
          <VdomChild/>
        </components.VaporChild>
      </template>`,
      {
        VaporChild: {
          code: `<template><div><slot/></div></template>`,
          vapor: true,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "<div>
      <!--[--><div><div>true</div></div><!--]-->
      </div>"
    `,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.value = false
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "<div>
      <!--[--><div><div>false</div></div><!--]-->
      </div>"
    `,
    )
  })
})
