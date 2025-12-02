import { nextTick, reactive } from 'vue'
import { compile, runtimeDom, runtimeVapor } from '../_utils'

describe.todo('VaporSuspense', () => {})

describe('vdom interop', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  async function testSuspense(
    code: string,
    components: Record<string, { code: string; vapor: boolean }> = {},
    data: any = {},
    { vapor = false } = {},
  ) {
    const clientComponents: any = {}
    for (const key in components) {
      const comp = components[key]
      let code = comp.code
      const isVaporComp = !!comp.vapor
      clientComponents[key] = compile(code, data, clientComponents, {
        vapor: isVaporComp,
      })
    }

    const clientComp = compile(code, data, clientComponents, {
      vapor,
    })

    const app = (vapor ? runtimeVapor.createVaporApp : runtimeDom.createApp)(
      clientComp,
    )
    app.use(runtimeVapor.vaporInteropPlugin)

    const container = document.createElement('div')
    document.body.appendChild(container)
    app.mount(container)
    return { container }
  }

  function withAsyncScript(code: string) {
    return {
      code: `
    <script vapor>
      const data = _data; 
      const components = _components;
      const p = new Promise(r => setTimeout(r, 5))
      data.deps.push(p.then(() => Promise.resolve()))
      await p
    </script>
    ${code}
    `,
      vapor: true,
    }
  }

  test('vdom suspense: render vapor components', async () => {
    const data = { deps: [] }
    const { container } = await testSuspense(
      `<script setup>
        const components = _components;
      </script>
      <template>
        <Suspense>
          <components.VaporChild/>
          <template #fallback>
            <span>fallback</span>
          </template>
        </Suspense>
      </template>`,
      {
        VaporChild: withAsyncScript(`<template><div>hi</div></template>`),
      },
      data,
    )

    expect(container.innerHTML).toBe(`<span>fallback</span>`)
    expect(data.deps.length).toBe(1)
    await Promise.all(data.deps)
    await nextTick()
    expect(container.innerHTML).toBe(`<div>hi</div>`)
  })

  test('vdom suspense: nested async vapor components', async () => {
    const data = { deps: [] }
    const { container } = await testSuspense(
      `<script setup>
        const components = _components;
      </script>
      <template>
        <Suspense>
          <components.AsyncOuter/>
          <template #fallback>
            <span>fallback</span>
          </template>
        </Suspense>
      </template>`,
      {
        AsyncOuter: withAsyncScript(
          `<template><components.AsyncInner/></template>`,
        ),
        AsyncInner: withAsyncScript(`<template><div>inner</div></template>`),
      },
      data,
    )

    expect(container.innerHTML).toBe(`<span>fallback</span>`)

    await data.deps[0]
    await nextTick()
    expect(container.innerHTML).toBe(`<span>fallback</span>`)

    await Promise.all(data.deps)
    await nextTick()
    expect(container.innerHTML).toBe(`<div>inner</div>`)
  })

  test('vdom suspense: content update before suspense resolve', async () => {
    const data = reactive({ msg: 'foo', deps: [] })
    const { container } = await testSuspense(
      `<script setup>
        const data = _data;
        const components = _components;
      </script>
      <template>
        <Suspense>
          <components.VaporChild/>
          <template #fallback>
            <span>fallback {{data.msg}}</span>
          </template>
        </Suspense>
      </template>`,
      {
        VaporChild: withAsyncScript(
          `<template><div>{{data.msg}}</div></template>`,
        ),
      },
      data,
    )

    expect(container.innerHTML).toBe(`<span>fallback foo</span>`)

    data.msg = 'bar'
    await nextTick()
    expect(container.innerHTML).toBe(`<span>fallback bar</span>`)

    await Promise.all(data.deps)
    await nextTick()
    expect(container.innerHTML).toBe(`<div>bar</div>`)
  })

  test('vdom suspense: unmount before suspense resolve', async () => {
    const data = reactive({ show: true, deps: [] })
    const { container } = await testSuspense(
      `<script setup>
        const data = _data;
        const components = _components;
      </script>
      <template>
        <Suspense>
          <components.VaporChild v-if="data.show"/>
          <template #fallback>
            <span>fallback</span>
          </template>
        </Suspense>
      </template>`,
      {
        VaporChild: withAsyncScript(`<template><div>child</div></template>`),
      },
      data,
    )

    expect(container.innerHTML).toBe(`<span>fallback</span>`)

    data.show = false
    await nextTick()
    expect(container.innerHTML).toBe(`<!--v-if-->`)

    await Promise.all(data.deps)
    await nextTick()
    expect(container.innerHTML).toBe(`<!--v-if-->`)
  })

  test('vdom suspense: unmount suspense after resolve', async () => {
    const data = reactive({ show: true, deps: [] })
    const { container } = await testSuspense(
      `<script setup>
        const data = _data;
        const components = _components;
      </script>
      <template>
        <Suspense v-if="data.show">
          <components.VaporChild/>
          <template #fallback>
            <span>fallback</span>
          </template>
        </Suspense>
      </template>`,
      {
        VaporChild: withAsyncScript(`<template><div>child</div></template>`),
      },
      data,
    )

    expect(container.innerHTML).toBe(`<span>fallback</span>`)

    await Promise.all(data.deps)
    await nextTick()
    expect(container.innerHTML).toBe(`<div>child</div>`)

    data.show = false
    await nextTick()
    expect(container.innerHTML).toBe(`<!--v-if-->`)
  })

  test('vdom suspense: unmount suspense before resolve', async () => {
    const data = reactive({ show: true, deps: [] })
    const { container } = await testSuspense(
      `<script setup>
        const data = _data;
        const components = _components;
      </script>
      <template>
        <Suspense v-if="data.show">
          <components.VaporChild/>
          <template #fallback>
            <span>fallback</span>
          </template>
        </Suspense>
      </template>`,
      {
        VaporChild: withAsyncScript(`<template><div>child</div></template>`),
      },
      data,
    )

    expect(container.innerHTML).toBe(`<span>fallback</span>`)

    data.show = false
    await nextTick()
    expect(container.innerHTML).toBe(`<!--v-if-->`)

    await Promise.all(data.deps)
    await nextTick()
    expect(container.innerHTML).toBe(`<!--v-if-->`)
  })
})
