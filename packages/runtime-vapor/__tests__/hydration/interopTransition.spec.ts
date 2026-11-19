import { markRaw, nextTick, reactive } from '@vue/runtime-dom'
import { setIsHydratingEnabled } from '../../src/dom/hydration'
import {
  setupHydrationTest,
  testWithVDOMApp,
  testWithVaporApp,
} from './_helpers'

setupHydrationTest()
beforeEach(() => {
  setIsHydratingEnabled(false)
})

describe('vapor slot content inside a vdom Transition', () => {
  type Run = {
    data: any
    step: (label: string, fn?: () => void) => Promise<void>
  }

  // A vapor App passes `content` to a vdom Wrapper rendering
  // `<Transition><slot/></Transition>`, server-rendered and hydrated; the
  // all-vdom chain is the control. Each step records the html without
  // anchors (and without the empty `style` vapor's appear hydration leaves,
  // as VaporTransition's does) and the hooks fired since the previous step.
  async function parity(
    transition: string,
    content: string,
    init: Record<string, any>,
    act: (r: Run) => Promise<void>,
  ) {
    const runs: string[][] = []
    for (const vaporApp of [false, true]) {
      const log: string[] = []
      const hook = (name: string) => (el: Element, done?: () => void) => {
        log.push(`${name}:${el.textContent}`)
        if (done) done()
      }
      const data = reactive({
        ...init,
        onBeforeEnter: hook('beforeEnter'),
        onEnter: hook('enter'),
        onAfterEnter: hook('afterEnter'),
        onBeforeLeave: hook('beforeLeave'),
        onLeave: hook('leave'),
        onAfterLeave: hook('afterLeave'),
        onBeforeAppear: hook('beforeAppear'),
        onAppear: hook('appear'),
        onAfterAppear: hook('afterAppear'),
      })
      const script = `const data = _data; const components = _components`
      const test = vaporApp ? testWithVaporApp : testWithVDOMApp
      const { container, app } = await test(
        `<script setup${vaporApp ? ' vapor' : ''}>${script}</script>` +
          `<template><components.Wrapper>${content}</components.Wrapper></template>`,
        {
          Wrapper: {
            code:
              `<script setup>${script}</script>` +
              `<template><Transition ${transition}><slot/></Transition></template>`,
            vapor: false,
          },
        },
        data,
      )
      const steps: string[] = []
      const step = async (label: string, fn?: () => void) => {
        if (fn) fn()
        await nextTick()
        steps.push(
          `${label}: ${container.innerHTML.replace(/<!--[^]*?-->| style=""/g, '')} | ${log.splice(0).join(' ')}`,
        )
      }
      await step('hydrated')
      await act({ data, step })
      app.unmount()
      runs.push(steps)
    }
    expect(runs[1]).toEqual(runs[0])
    return runs[0]
  }

  const hooks =
    `:css="false" @before-enter="data.onBeforeEnter" @enter="data.onEnter" ` +
    `@after-enter="data.onAfterEnter" @before-leave="data.onBeforeLeave" ` +
    `@leave="data.onLeave" @after-leave="data.onAfterLeave"`
  const appearHooks =
    `appear @before-appear="data.onBeforeAppear" @appear="data.onAppear" ` +
    `@after-appear="data.onAfterAppear"`

  test('hydrated v-if content leaves and enters', async () => {
    const steps = await parity(
      hooks,
      `<div v-if="data.show">x</div>`,
      { show: true },
      async r => {
        await r.step('hide', () => (r.data.show = false))
        await r.step('show', () => (r.data.show = true))
      },
    )
    expect(steps).toEqual([
      'hydrated: <div>x</div> | ',
      'hide:  | beforeLeave:x leave:x afterLeave:x',
      'show: <div>x</div> | beforeEnter:x enter:x afterEnter:x',
    ])
  })

  test('content the server rendered nothing of enters', async () => {
    const steps = await parity(
      hooks,
      `<div v-if="data.show">x</div>`,
      { show: false },
      async r => {
        await r.step('show', () => (r.data.show = true))
        await r.step('hide', () => (r.data.show = false))
      },
    )
    expect(steps).toEqual([
      'hydrated:  | ',
      'show: <div>x</div> | beforeEnter:x enter:x afterEnter:x',
      'hide:  | beforeLeave:x leave:x afterLeave:x',
    ])
  })

  // the server wraps the content of an appearing Transition in a <template>
  test('appear runs on the hydrated content', async () => {
    const steps = await parity(
      `${appearHooks} ${hooks}`,
      `<div v-if="data.show">x</div>`,
      { show: true },
      async r => {
        await r.step('hide', () => (r.data.show = false))
        await r.step('show', () => (r.data.show = true))
      },
    )
    expect(steps).toEqual([
      'hydrated: <div>x</div> | beforeAppear:x appear:x afterAppear:x',
      'hide:  | beforeLeave:x leave:x afterLeave:x',
      'show: <div>x</div> | beforeEnter:x enter:x afterEnter:x',
    ])
  })
})

describe('vdom Transition inside a vapor app', () => {
  // the vdom hydrator replaces the <template> the server wraps an appearing
  // Transition's content in: the next node is resolved from where it was
  test('appear content ends its parent', async () => {
    const { container } = await testWithVaporApp(
      `<script setup vapor>const components = _components</script>` +
        `<template><components.Wrapper /></template>`,
      {
        Wrapper: {
          code: `<script setup>const data = _data</script><template><Transition appear :css="false"><div>x</div></Transition></template>`,
          vapor: false,
        },
      },
      reactive({}),
    )
    expect(container.innerHTML).toBe('<!--{--><div>x</div><!--}-->')
  })
})

// the client renders the branch the server did not anew: the vdom element it
// mounts appears, not the server one it replaces
test('vapor Transition appear on a vdom branch the server did not render', async () => {
  const { container } = await testWithVaporApp(
    `<template>
      <Transition appear>
        <components.V v-if="data.a" />
        <components.V v-else />
      </Transition>
      <i>tail</i>
    </template>`,
    {
      V: {
        code: `<script setup>const data = _data</script>
          <template><div>{{ data.a ? 'a' : 'b' }}</div></template>`,
        vapor: false,
      },
    },
    reactive({ a: false }),
    reactive({ a: true }),
  )
  const div = container.querySelector('div')!
  expect(div.textContent).toBe('b')
  expect(div.className).toBe('v-enter-from v-enter-active')
  expect(container.querySelectorAll('i')).toHaveLength(1)
  expect('Hydration node mismatch').toHaveBeenWarnedTimes(1)
})

describe('fallthrough attrs on a vapor component wrapping its slot in a Transition', () => {
  const hydrate = (parent: string, data: any) =>
    testWithVDOMApp(
      `<script setup>const data = _data; const components = _components</script>
      <template>
        ${parent}
      </template>`,
      {
        Fade: `<script setup vapor>const data = _data</script>
          <template>
            <Transition :css="false" :data-y="data.y">
              <slot />
            </Transition>
          </template>`,
      },
      data,
    )

  test('a listener works on the hydrated content root', async () => {
    const data = reactive({ n: 0 })
    const { container } = await hydrate(
      `<components.Fade @click="data.n++">
        <button>{{ data.n }}</button>
      </components.Fade>`,
      data,
    )
    const button = container.querySelector('button')!
    button.click()
    await nextTick()
    expect(button.textContent).toBe('1')

    button.click()
    await nextTick()
    expect(button.textContent).toBe('2')
  })

  // the server renders none of them on the slot content, a vdom one neither
  test('the hydrated content root takes the attrs and follows their updates', async () => {
    const data = reactive({ cls: 'w', y: 1 })
    const { container } = await hydrate(
      `<components.Fade :class="data.cls" data-x="1">
        <div>a</div>
      </components.Fade>`,
      data,
    )
    const div = container.querySelector('div')!
    expect(div.outerHTML).toBe(`<div data-y="1" class="w" data-x="1">a</div>`)

    data.cls = 'w2'
    data.y = 2
    await nextTick()
    expect(div.outerHTML).toBe(`<div data-y="2" class="w2" data-x="1">a</div>`)
  })
})

describe('vdom directives on a vapor component wrapping its slot in a Transition', () => {
  // what `v-log` saw
  let log: string[]
  const hydrate = (
    content: string,
    data: any,
    dirs = `v-show="data.show"`,
    slot = `<slot />`,
  ) => {
    log = []
    const vLog: Record<string, any> = {}
    for (const name of [
      'created',
      'beforeMount',
      'mounted',
      'beforeUpdate',
      'updated',
      'beforeUnmount',
      'unmounted',
    ]) {
      vLog[name] = (el: Element, { value, oldValue }: any) =>
        log.push(`${name} ${el.tagName} ${oldValue}>${value}`)
    }
    data.vLog = markRaw(vLog)
    return testWithVDOMApp(
      `<script setup>
        const data = _data; const components = _components
        const vLog = data.vLog
      </script>
      <template>
        <components.Fade ${dirs}>
          ${content}
        </components.Fade>
      </template>`,
      {
        Fade: `<template>
          <Transition :css="false">
            ${slot}
          </Transition>
        </template>`,
      },
      data,
    )
  }

  // the content hydrates ahead of the hand-over of the parent's directives
  test.each([
    ['the hydrated content root', `<div>x</div>`, `<slot />`],
    ['the fallback root the server rendered', ``, `<slot><div>fb</div></slot>`],
  ])('land on %s', async (_, content, slot) => {
    const data = reactive({ show: true })
    const { container } = await hydrate(content, data, undefined, slot)
    const div = container.querySelector('div')!
    data.show = false
    await nextTick()
    expect(div.style.display).toBe('none')

    data.show = true
    await nextTick()
    expect(div.style.display).toBe('')
  })

  // neither renderer has the server hide it
  test('hide a hydrated content root the server rendered shown', async () => {
    const data = reactive({ show: false })
    const { container } = await hydrate(`<div>x</div>`, data)
    const div = container.querySelector('div')!
    expect(div.style.display).toBe('none')

    data.show = true
    await nextTick()
    expect(div.style.display).toBe('')
  })

  test('run their hooks on the hydrated content root as on the root of a vdom component', async () => {
    const data = reactive({ n: 1 })
    const { app } = await hydrate(`<div>x</div>`, data, `v-log="data.n"`)
    data.n = 2
    await nextTick()
    app.unmount()
    expect(log).toEqual([
      'created DIV undefined>1',
      'beforeMount DIV undefined>1',
      'mounted DIV undefined>1',
      'beforeUpdate DIV 1>2',
      'updated DIV 1>2',
      'beforeUnmount DIV 1>2',
      'unmounted DIV 1>2',
    ])
  })

  test('leave a hydrated content root its own', async () => {
    const data = reactive({ show: true, visible: true })
    const { container } = await hydrate(
      `<div v-show="data.visible">x</div>`,
      data,
    )
    const div = container.querySelector('div')!
    data.visible = false
    await nextTick()
    expect(div.style.display).toBe('none')

    data.visible = true
    await nextTick()
    expect(div.style.display).toBe('')
  })

  test('land on the root replacing a hydrated one', async () => {
    const data = reactive({ show: true, a: true })
    const { container } = await hydrate(
      `<div v-if="data.a">x</div>
      <p v-else>y</p>`,
      data,
    )
    data.a = false
    await nextTick()
    const p = container.querySelector('p')!
    expect(p.style.display).toBe('')

    data.show = false
    await nextTick()
    expect(p.style.display).toBe('none')
  })

  test.each([
    [
      'a hydrated content root replaced by another',
      `<div v-if="data.a">x</div>
      <p v-else>y</p>`,
      `<slot />`,
    ],
    [
      'a hydrated content root replaced by the fallback',
      `<div v-if="data.a">x</div>`,
      `<slot><p>fb</p></slot>`,
    ],
    [
      'the fallback root the server rendered replaced by content',
      `<p v-if="!data.a">y</p>`,
      `<slot><div>fb</div></slot>`,
    ],
  ])('leave %s', async (_, content, slot) => {
    const data = reactive({ n: 1, a: true })
    await hydrate(content, data, `v-log="data.n"`, slot)
    await nextTick()
    log.length = 0
    data.a = false
    await nextTick()
    expect(log).toEqual([
      // a vapor root is patched by the re-render that goes on to replace it,
      // which a vdom one is not; the rest is the vdom order
      'beforeUpdate DIV 1>1',
      'beforeUnmount DIV 1>1',
      'created P 1>1',
      'beforeMount P 1>1',
      'unmounted DIV 1>1',
      'mounted P undefined>1',
    ])

    log.length = 0
    data.n = 2
    await nextTick()
    expect(log).toEqual(['beforeUpdate P 1>2', 'updated P 1>2'])
  })

  // handing the hydrated root over to the Transition is no update of it
  test.each([
    ['on the hydrated content root', `<div v-log="data.n">x</div>`, 'DIV'],
    ['inside the hydrated content', `<div><p v-log="data.n">x</p></div>`, 'P'],
  ])('are not updated %s', async (_, content, tag) => {
    const data = reactive({ n: 1 })
    await hydrate(content, data, '')
    await nextTick()
    expect(log).toEqual([
      `created ${tag} undefined>1`,
      `beforeMount ${tag} undefined>1`,
      `mounted ${tag} undefined>1`,
    ])
  })
})

// the content hydrates ahead of the Transition's hooks reaching the outlet;
// a vdom component is the control
test.each([
  ['a vdom component', false],
  ['a vapor component', true],
])(
  '%s wrapping its slot in a Transition runs the hooks on a hydrated vdom child switching its own root',
  async (_, vapor) => {
    const log: string[] = []
    const hook = (name: string) => (el: Element, done: () => void) => {
      log.push(`${name}:${el.tagName}`)
      done()
    }
    const data = reactive({
      a: true,
      onEnter: hook('enter'),
      onLeave: hook('leave'),
    })
    await testWithVDOMApp(
      `<script setup>const components = _components</script>
      <template>
        <components.Fade>
          <components.Child />
        </components.Fade>
      </template>`,
      {
        Child: {
          code: `<script setup>const data = _data</script>
            <template>
              <div v-if="data.a">x</div>
              <p v-else>y</p>
            </template>`,
          vapor: false,
        },
        Fade: {
          code: `<script setup>const data = _data</script>
            <template>
              <Transition
                :css="false"
                @enter="data.onEnter"
                @leave="data.onLeave"
              >
                <slot />
              </Transition>
            </template>`,
          vapor,
        },
      },
      data,
    )
    // only Child reads `data.a`: the slot is not patched again
    data.a = false
    await nextTick()
    expect(log).toEqual(['leave:DIV', 'enter:P'])
  },
)

// handing the hydrated child over to the Transition is no update of it; a
// vdom component is the control
test.each([
  ['a vdom component', false],
  ['a vapor component', true],
])(
  '%s wrapping its slot in a Transition does not update a hydrated vdom child',
  async (_, vapor) => {
    const log: string[] = []
    const data = reactive({
      log: (hook: string) => log.push(hook),
      vLog: markRaw({ updated: () => log.push('directive updated') }),
    })
    await testWithVDOMApp(
      `<script setup>const components = _components</script>
      <template>
        <components.Fade>
          <components.Child />
        </components.Fade>
      </template>`,
      {
        Child: {
          code: `<script setup>
              import { onBeforeUpdate, onMounted, onUpdated } from 'vue'
              const data = _data
              const vLog = data.vLog
              onMounted(() => data.log('mounted'))
              onBeforeUpdate(() => data.log('beforeUpdate'))
              onUpdated(() => data.log('updated'))
            </script>
            <template>
              <div>
                <p v-log>x</p>
              </div>
            </template>`,
          vapor: false,
        },
        Fade: {
          code: `<script setup>const data = _data</script>
            <template>
              <Transition :css="false">
                <slot />
              </Transition>
            </template>`,
          vapor,
        },
      },
      data,
    )
    await nextTick()
    expect(log).toEqual(['mounted'])
  },
)

// an update ahead of its hydration has an async child skip it, and a Suspense
// still hydrating has no active branch to tell its end by; a vdom component
// is the control
test.each([
  ['a vdom component', 'as its content', false, `<Lazy />`],
  ['a vapor component', 'as its content', true, `<Lazy />`],
  ['a vdom component', 'in a Suspense', false, `<Suspense><Lazy /></Suspense>`],
  ['a vapor component', 'in a Suspense', true, `<Suspense><Lazy /></Suspense>`],
])(
  '%s wrapping its slot in a Transition leaves a vdom async child %s to hydrate',
  async (_, __, vapor, content) => {
    const { container } = await testWithVDOMApp(
      `<script setup>
        import { defineAsyncComponent } from 'vue'
        const components = _components
        const Lazy = defineAsyncComponent(() =>
          Promise.resolve(components.Part),
        )
      </script>
      <template>
        <components.Fade>
          ${content}
        </components.Fade>
      </template>`,
      {
        Part: {
          code: `<script setup>const data = _data</script>
            <template>
              <div>x</div>
            </template>`,
          vapor: false,
        },
        Fade: {
          code: `<script setup>const data = _data</script>
            <template>
              <Transition :css="false">
                <slot />
              </Transition>
            </template>`,
          vapor,
        },
      },
      reactive({}),
    )
    const div = container.querySelector('div')
    expect(div).not.toBeNull()
    await new Promise(r => setTimeout(r))
    expect(container.querySelector('div')).toBe(div)
  },
)
