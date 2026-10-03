import { nextTick, reactive } from '@vue/runtime-dom'
import { setIsHydratingEnabled } from '../../src/dom/hydration'
import {
  setupHydrationTest,
  testWithVDOMApp,
  testWithVaporApp,
} from './_helpers'

setupHydrationTest()

describe('vapor slot content inside a vdom Transition', () => {
  beforeEach(() => {
    setIsHydratingEnabled(false)
  })

  type Run = {
    data: any
    step: (label: string, fn?: () => void) => Promise<void>
  }

  // A vapor App passes `content` to a vdom Wrapper rendering
  // `<Transition><slot/></Transition>`, server-rendered and hydrated; the
  // all-vdom chain is the control. Each step records the html without
  // anchors and the hooks fired since the previous step.
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
          `${label}: ${container.innerHTML.replace(/<!--[^]*?-->/g, '')} | ${log.splice(0).join(' ')}`,
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
})
