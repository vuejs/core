import { type Ref, nextTick, ref } from '@vue/runtime-dom'
import { compile, makeInteropRender } from './_utils'

const define = makeInteropRender()

type Run = {
  data: Ref<any>
  done: Record<string, () => void>
  step: (label: string, fn?: () => void) => Promise<void>
}

// Runs `act` against the App `makeApp` builds in vapor mode and in the
// all-vdom control, and checks that both record the same steps. Each step
// records the html without anchors and the transition hooks fired since the
// previous step; `enter`/`leave`/`appear` hold their `done`.
async function compareRuns(
  makeApp: (vapor: boolean, data: Ref<any>, script: string) => any,
  act: (r: Run) => Promise<void>,
) {
  const runs: string[][] = []
  for (const vapor of [false, true]) {
    const log: string[] = []
    const done: Record<string, () => void> = {}
    const sync = (name: string) => (el: Element) =>
      log.push(`${name}:${el.textContent}`)
    const held = (name: string) => (el: Element, d: () => void) => {
      log.push(`${name}:${el.textContent}`)
      done[name] = d
    }
    const data = ref<any>({
      show: true,
      alt: false,
      onBeforeEnter: sync('beforeEnter'),
      onEnter: held('enter'),
      onAfterEnter: sync('afterEnter'),
      onEnterCancelled: sync('enterCancelled'),
      onBeforeLeave: sync('beforeLeave'),
      onLeave: held('leave'),
      onAfterLeave: sync('afterLeave'),
      onLeaveCancelled: sync('leaveCancelled'),
      onBeforeAppear: sync('beforeAppear'),
      onAppear: held('appear'),
      onAfterAppear: sync('afterAppear'),
      onAppearCancelled: sync('appearCancelled'),
    })
    const App = makeApp(
      vapor,
      data,
      `const data = _data; const components = _components`,
    )
    const { app, host, html } = define(App).render()
    // v-show only leaves a connected element
    document.body.appendChild(host)
    const steps: string[] = []
    const step = async (label: string, fn?: () => void) => {
      if (fn) fn()
      await nextTick()
      steps.push(
        `${label}: ${html().replace(/<!--[^]*?-->/g, '')} | ${log.splice(0).join(' ')}`,
      )
    }
    await step('mount')
    try {
      await act({ data, done, step })
    } catch (e: any) {
      e.message += `\n${vapor ? 'vapor' : 'vdom'} steps so far:\n${steps.join('\n')}`
      throw e
    }
    app.unmount()
    host.remove()
    runs.push(steps)
  }
  expect(runs[1]).toEqual(runs[0])
  return runs[0]
}

const hooks =
  `:css="false" @before-enter="data.onBeforeEnter" @enter="data.onEnter" ` +
  `@after-enter="data.onAfterEnter" @enter-cancelled="data.onEnterCancelled" ` +
  `@before-leave="data.onBeforeLeave" @leave="data.onLeave" ` +
  `@after-leave="data.onAfterLeave" @leave-cancelled="data.onLeaveCancelled"`
const appearHooks =
  `appear @before-appear="data.onBeforeAppear" @appear="data.onAppear" ` +
  `@after-appear="data.onAfterAppear" @appear-cancelled="data.onAppearCancelled"`
const wrap = (attrs: string, slot = '<slot/>') =>
  `<Transition ${attrs}>${slot}</Transition>`

describe('vapor slot content inside a vdom Transition', () => {
  // A vapor App passes `content` to a vdom Wrapper whose template is
  // `transition` (a `<Transition>` around a `<slot/>`)
  const parity = (
    transition: string,
    content: string,
    act: (r: Run) => Promise<void>,
  ) =>
    compareRuns((vapor, data, script) => {
      const Child = compile(
        `<script setup${vapor ? ' vapor' : ''}>${script}</script>` +
          `<template><div v-if="!data.alt">child</div></template>`,
        data,
        {},
        { vapor },
      )
      const Wrapper = compile(
        `<script setup>${script}</script><template>${transition}</template>`,
        data,
        {},
        { vapor: false },
      )
      return compile(
        `<script setup${vapor ? ' vapor' : ''}>${script}</script>` +
          `<template><components.Wrapper>${content}</components.Wrapper></template>`,
        data,
        { Wrapper, Child },
        { vapor },
      )
    }, act)

  test('v-if content leaves and enters', async () => {
    const steps = await parity(
      wrap(hooks),
      `<div v-if="data.show">x</div>`,
      async r => {
        await r.step('hide', () => (r.data.value.show = false))
        await r.step('leave done', () => r.done.leave())
        await r.step('show', () => (r.data.value.show = true))
        await r.step('enter done', () => r.done.enter())
      },
    )
    expect(steps).toEqual([
      'mount: <div>x</div> | ',
      'hide: <div>x</div> | beforeLeave:x leave:x',
      'leave done:  | afterLeave:x',
      'show: <div>x</div> | beforeEnter:x enter:x',
      'enter done: <div>x</div> | afterEnter:x',
    ])
  })

  test('v-show content toggles in place, cancelling the pending phase', async () => {
    const steps = await parity(
      wrap(hooks),
      `<div v-show="data.show">x</div>`,
      async r => {
        await r.step('hide', () => (r.data.value.show = false))
        await r.step('show while leaving', () => (r.data.value.show = true))
        await r.step('hide while entering', () => (r.data.value.show = false))
        await r.step('leave done', () => r.done.leave())
      },
    )
    expect(steps).toEqual([
      'mount: <div>x</div> | ',
      'hide: <div>x</div> | beforeLeave:x leave:x',
      'show while leaving: <div style="">x</div> | leaveCancelled:x beforeEnter:x enter:x',
      'hide while entering: <div style="">x</div> | enterCancelled:x beforeLeave:x leave:x',
      'leave done: <div style="display: none;">x</div> | afterLeave:x',
    ])
  })

  test.each(['default', 'out-in', 'in-out'])(
    'v-if/else branches switch under mode %s',
    async mode => {
      const steps = await parity(
        wrap(`mode="${mode}" ${hooks}`),
        `<div v-if="data.show">a</div><p v-else>b</p>`,
        async r => {
          await r.step('swap', () => (r.data.value.show = false))
          if (mode === 'in-out') {
            await r.step('enter done', () => r.done.enter())
            await r.step('leave done', () => r.done.leave())
          } else {
            await r.step('leave done', () => r.done.leave())
            await r.step('enter done', () => r.done.enter())
          }
        },
      )
      expect(steps).toEqual(
        mode === 'out-in'
          ? [
              'mount: <div>a</div> | ',
              'swap: <div>a</div> | beforeLeave:a leave:a',
              'leave done: <p>b</p> | beforeEnter:b afterLeave:a enter:b',
              'enter done: <p>b</p> | afterEnter:b',
            ]
          : mode === 'in-out'
            ? [
                'mount: <div>a</div> | ',
                'swap: <div>a</div><p>b</p> | beforeEnter:b enter:b',
                'enter done: <div>a</div><p>b</p> | afterEnter:b beforeLeave:a leave:a',
                'leave done: <p>b</p> | afterLeave:a',
              ]
            : [
                'mount: <div>a</div> | ',
                'swap: <div>a</div><p>b</p> | beforeLeave:a leave:a beforeEnter:b enter:b',
                'leave done: <p>b</p> | afterLeave:a',
                'enter done: <p>b</p> | afterEnter:b',
              ],
      )
    },
  )

  test('dynamic component content switches under out-in', async () => {
    const steps = await parity(
      wrap(`mode="out-in" ${hooks}`),
      `<component :is="data.show ? 'div' : 'p'">c</component>`,
      async r => {
        await r.step('swap', () => (r.data.value.show = false))
        await r.step('leave done', () => r.done.leave())
      },
    )
    expect(steps).toEqual([
      'mount: <div>c</div> | ',
      'swap: <div>c</div> | beforeLeave:c leave:c',
      'leave done: <p>c</p> | beforeEnter:c afterLeave:c enter:c',
    ])
  })

  test('keyed content swaps', async () => {
    const steps = await parity(
      wrap(hooks),
      `<div :key="data.show">{{ data.show }}</div>`,
      async r => {
        await r.step('swap', () => (r.data.value.show = false))
        await r.step('leave done', () => r.done.leave())
      },
    )
    expect(steps).toEqual([
      'mount: <div>true</div> | ',
      'swap: <div>true</div><div>false</div> | beforeLeave:true leave:true beforeEnter:false enter:false',
      'leave done: <div>false</div> | afterLeave:true',
    ])
  })

  test('appear hooks run on mount, and are cancelled by a leave', async () => {
    const steps = await parity(
      wrap(`${appearHooks} ${hooks}`),
      `<div v-if="data.show">x</div>`,
      async r => {
        await r.step('appear done', () => r.done.appear())
        await r.step('hide', () => (r.data.value.show = false))
      },
    )
    expect(steps).toEqual([
      'mount: <div>x</div> | beforeAppear:x appear:x',
      'appear done: <div>x</div> | afterAppear:x',
      'hide: <div>x</div> | beforeLeave:x leave:x',
    ])
    const cancelled = await parity(
      wrap(`${appearHooks} ${hooks}`),
      `<div v-if="data.show">x</div>`,
      async r => {
        await r.step('hide while appearing', () => (r.data.value.show = false))
      },
    )
    expect(cancelled[1]).toBe(
      'hide while appearing: <div>x</div> | appearCancelled:x beforeLeave:x leave:x',
    )
  })

  test('a leave cancels a pending enter; re-showing early-removes the leaving node', async () => {
    const steps = await parity(
      wrap(hooks),
      `<div v-if="data.show">x</div>`,
      async r => {
        await r.step('hide', () => (r.data.value.show = false))
        await r.step('leave done', () => r.done.leave())
        await r.step('show', () => (r.data.value.show = true))
        await r.step('hide while entering', () => (r.data.value.show = false))
        await r.step('show while leaving', () => (r.data.value.show = true))
        await r.step('enter done', () => r.done.enter())
      },
    )
    expect(steps.slice(3)).toEqual([
      'show: <div>x</div> | beforeEnter:x enter:x',
      'hide while entering: <div>x</div> | enterCancelled:x beforeLeave:x leave:x',
      'show while leaving: <div>x</div> | afterLeave:x beforeEnter:x enter:x',
      'enter done: <div>x</div> | afterEnter:x',
    ])
  })

  test('a slot the wrapper renders later enters, and leaves when the wrapper drops it', async () => {
    const steps = await parity(
      wrap(hooks, '<slot v-if="data.alt"/>'),
      `<div>x</div>`,
      async r => {
        await r.step('on', () => (r.data.value.alt = true))
        await r.step('enter done', () => r.done.enter())
        await r.step('off', () => (r.data.value.alt = false))
        await r.step('leave done', () => r.done.leave())
      },
    )
    expect(steps).toEqual([
      'mount:  | ',
      'on: <div>x</div> | beforeEnter:x enter:x',
      'enter done: <div>x</div> | afterEnter:x',
      'off: <div>x</div> | beforeLeave:x leave:x',
      'leave done:  | afterLeave:x',
    ])
  })

  test('re-resolves hooks when the wrapper re-renders with other transition props', async () => {
    const steps = await parity(
      wrap(`:css="false" :onLeave="data.alt ? data.onLeaveB : data.onLeave"`),
      `<div v-if="data.show">x</div>`,
      async r => {
        r.data.value.onLeaveB = (el: Element, d: () => void) => {
          r.data.value.leftB = el.textContent
          d()
        }
        await r.step('swap hook', () => (r.data.value.alt = true))
        await r.step('hide', () => (r.data.value.show = false))
        await r.step(`left by B: ${r.data.value.leftB}`)
      },
    )
    expect(steps).toEqual([
      'mount: <div>x</div> | ',
      'swap hook: <div>x</div> | ',
      'hide:  | ',
      'left by B: x:  | ',
    ])
  })

  test('component content, and the root the component toggles itself', async () => {
    const steps = await parity(
      wrap(hooks),
      `<components.Child v-if="data.show" />`,
      async r => {
        await r.step('hide', () => (r.data.value.show = false))
        await r.step('leave done', () => r.done.leave())
        await r.step('show', () => (r.data.value.show = true))
        await r.step('enter done', () => r.done.enter())
        await r.step('inner hide', () => (r.data.value.alt = true))
        await r.step('leave done', () => r.done.leave())
        await r.step('inner show', () => (r.data.value.alt = false))
      },
    )
    expect(steps).toEqual([
      'mount: <div>child</div> | ',
      'hide: <div>child</div> | beforeLeave:child leave:child',
      'leave done:  | afterLeave:child',
      'show: <div>child</div> | beforeEnter:child enter:child',
      'enter done: <div>child</div> | afterEnter:child',
      'inner hide: <div>child</div> | beforeLeave:child leave:child',
      'leave done:  | afterLeave:child',
      'inner show: <div>child</div> | beforeEnter:child enter:child',
    ])
  })
  // the wrapper switches between the slot and a vdom sibling: the vdom
  // Transition drives the leave, with its mode handoff on the vnode's hooks
  const sibling = (mode: string) =>
    wrap(`mode="${mode}" ${hooks}`, '<slot v-if="data.alt"/><p v-else>p</p>')

  test('out-in switch between the slot and a vdom sibling', async () => {
    const steps = await parity(
      sibling('out-in'),
      `<div v-if="data.show">x</div>`,
      async r => {
        await r.step('to slot', () => (r.data.value.alt = true))
        await r.step('leave done', () => r.done.leave())
        await r.step('enter done', () => r.done.enter())
        await r.step('to p', () => (r.data.value.alt = false))
        await r.step('leave done', () => r.done.leave())
        await r.step('enter done', () => r.done.enter())
      },
    )
    expect(steps).toEqual([
      'mount: <p>p</p> | ',
      'to slot: <p>p</p> | beforeLeave:p leave:p',
      'leave done: <div>x</div> | beforeEnter:x afterLeave:p enter:x',
      'enter done: <div>x</div> | afterEnter:x',
      'to p: <div>x</div> | beforeLeave:x leave:x',
      'leave done: <p>p</p> | beforeEnter:p afterLeave:x enter:p',
      'enter done: <p>p</p> | afterEnter:p',
    ])
  })

  test('in-out switch between the slot and a vdom sibling', async () => {
    const steps = await parity(
      sibling('in-out'),
      `<div v-if="data.show">x</div>`,
      async r => {
        await r.step('to slot', () => (r.data.value.alt = true))
        await r.step('enter done', () => r.done.enter())
        await r.step('leave done', () => r.done.leave())
        await r.step('to p', () => (r.data.value.alt = false))
        await r.step('enter done', () => r.done.enter())
        await r.step('leave done', () => r.done.leave())
      },
    )
    expect(steps).toEqual([
      'mount: <p>p</p> | ',
      'to slot: <p>p</p><div>x</div> | beforeEnter:x enter:x',
      'enter done: <p>p</p><div>x</div> | afterEnter:x beforeLeave:p leave:p',
      'leave done: <div>x</div> | afterLeave:p',
      'to p: <div>x</div><p>p</p> | beforeEnter:p enter:p',
      'enter done: <div>x</div><p>p</p> | afterEnter:p beforeLeave:x leave:x',
      'leave done: <p>p</p> | afterLeave:x',
    ])
  })

  test('out-in switch away from a slot with nothing to leave', async () => {
    const steps = await parity(
      sibling('out-in'),
      `<div v-if="data.show">x</div>`,
      async r => {
        r.data.value.show = false
        await r.step('to slot', () => (r.data.value.alt = true))
        await r.step('leave done', () => r.done.leave())
        await r.step('to p', () => (r.data.value.alt = false))
        await r.step('enter done', () => r.done.enter())
      },
    )
    expect(steps).toEqual([
      'mount: <p>p</p> | ',
      'to slot: <p>p</p> | beforeLeave:p leave:p',
      'leave done:  | afterLeave:p',
      'to p: <p>p</p> | beforeEnter:p enter:p',
      'enter done: <p>p</p> | afterEnter:p',
    ])
  })

  // the wrapper's outlet has a fallback: it is the Transition's child while
  // the slot content is invalid
  const withFallback = (attrs: string) =>
    wrap(attrs, '<slot><span>fb</span></slot>')

  test('fallback enters when the content leaves, and leaves when it returns', async () => {
    const steps = await parity(
      withFallback(hooks),
      `<div v-if="data.show">x</div>`,
      async r => {
        await r.step('hide', () => (r.data.value.show = false))
        await r.step('leave done', () => r.done.leave())
        await r.step('enter done', () => r.done.enter())
        await r.step('show', () => (r.data.value.show = true))
        await r.step('leave done', () => r.done.leave())
        await r.step('enter done', () => r.done.enter())
      },
    )
    expect(steps).toEqual([
      'mount: <div>x</div> | ',
      'hide: <div>x</div><span>fb</span> | beforeLeave:x leave:x beforeEnter:fb enter:fb',
      'leave done: <span>fb</span> | afterLeave:x',
      'enter done: <span>fb</span> | afterEnter:fb',
      'show: <span>fb</span><div>x</div> | beforeLeave:fb leave:fb beforeEnter:x enter:x',
      'leave done: <div>x</div> | afterLeave:fb',
      'enter done: <div>x</div> | afterEnter:x',
    ])
  })

  test('a fallback shown from the start leaves when the content appears', async () => {
    const steps = await parity(
      withFallback(hooks),
      `<div v-if="data.alt">x</div>`,
      async r => {
        await r.step('show', () => (r.data.value.alt = true))
        await r.step('leave done', () => r.done.leave())
        await r.step('enter done', () => r.done.enter())
        await r.step('hide', () => (r.data.value.alt = false))
        await r.step('leave done', () => r.done.leave())
        await r.step('enter done', () => r.done.enter())
      },
    )
    expect(steps).toEqual([
      'mount: <span>fb</span> | ',
      'show: <span>fb</span><div>x</div> | beforeLeave:fb leave:fb beforeEnter:x enter:x',
      'leave done: <div>x</div> | afterLeave:fb',
      'enter done: <div>x</div> | afterEnter:x',
      'hide: <div>x</div><span>fb</span> | beforeLeave:x leave:x beforeEnter:fb enter:fb',
      'leave done: <span>fb</span> | afterLeave:x',
      'enter done: <span>fb</span> | afterEnter:fb',
    ])
  })
})

describe('vapor component as the child of a vdom Transition', () => {
  // A vdom App renders `transition` (a `<Transition>` around
  // `<components.Child/>`) with `child` as the Child's template
  const parity = (
    transition: string,
    child: string,
    act: (r: Run) => Promise<void>,
    // templates of components the Child renders
    nested: Record<string, string> = {},
  ) =>
    compareRuns((vapor, data, script) => {
      const components: Record<string, any> = {}
      for (const name in nested) {
        components[name] = compile(
          `<script setup${vapor ? ' vapor' : ''}>${script}</script>` +
            `<template>${nested[name]}</template>`,
          data,
          {},
          { vapor },
        )
      }
      const Child = compile(
        `<script setup${vapor ? ' vapor' : ''}>${script}</script>` +
          `<template>${child}</template>`,
        data,
        components,
        { vapor },
      )
      return compile(
        `<script setup>${script}</script><template>${transition}</template>`,
        data,
        { Child },
        { vapor: false },
      )
    }, act)

  const around = (attrs: string, child = '<components.Child/>') =>
    `<Transition ${attrs}>${child}</Transition>`

  test('the root the child toggles itself leaves and enters', async () => {
    const steps = await parity(
      around(hooks),
      `<div v-if="data.show">c</div>`,
      async r => {
        await r.step('hide', () => (r.data.value.show = false))
        await r.step('leave done', () => r.done.leave())
        await r.step('show', () => (r.data.value.show = true))
        await r.step('enter done', () => r.done.enter())
        await r.step('hide again', () => (r.data.value.show = false))
      },
    )
    expect(steps).toEqual([
      'mount: <div>c</div> | ',
      'hide: <div>c</div> | beforeLeave:c leave:c',
      'leave done:  | afterLeave:c',
      'show: <div>c</div> | beforeEnter:c enter:c',
      'enter done: <div>c</div> | afterEnter:c',
      'hide again: <div>c</div> | beforeLeave:c leave:c',
    ])
  })

  test('a root hidden from the start enters', async () => {
    const steps = await parity(
      around(hooks),
      `<div v-if="data.alt">c</div>`,
      async r => {
        await r.step('show', () => (r.data.value.alt = true))
        await r.step('enter done', () => r.done.enter())
      },
    )
    expect(steps).toEqual([
      'mount:  | ',
      'show: <div>c</div> | beforeEnter:c enter:c',
      'enter done: <div>c</div> | afterEnter:c',
    ])
  })

  test.each(['default', 'out-in'])(
    'a root switched by the child early-removes the previous one under mode %s',
    async mode => {
      const steps = await parity(
        around(`mode="${mode}" ${hooks}`),
        `<div v-if="data.show">a</div><p v-else>b</p>`,
        async r => {
          await r.step('swap', () => (r.data.value.show = false))
          await r.step('enter done', () => r.done.enter())
        },
      )
      expect(steps).toEqual([
        'mount: <div>a</div> | ',
        'swap: <p>b</p> | beforeLeave:a leave:a afterLeave:a beforeEnter:b enter:b',
        'enter done: <p>b</p> | afterEnter:b',
      ])
    },
  )

  test('re-showing the child while it leaves early-removes the leaving root', async () => {
    const steps = await parity(
      around(hooks, '<components.Child v-if="data.show"/>'),
      `<div>c</div>`,
      async r => {
        await r.step('hide', () => (r.data.value.show = false))
        await r.step('show while leaving', () => (r.data.value.show = true))
        await r.step('enter done', () => r.done.enter())
      },
    )
    expect(steps).toEqual([
      'mount: <div>c</div> | ',
      'hide: <div>c</div> | beforeLeave:c leave:c',
      'show while leaving: <div>c</div> | afterLeave:c beforeEnter:c enter:c',
      'enter done: <div>c</div> | afterEnter:c',
    ])
  })

  test('a v-show root toggles in place', async () => {
    const steps = await parity(
      around(hooks),
      `<div v-show="data.show">c</div>`,
      async r => {
        await r.step('hide', () => (r.data.value.show = false))
        await r.step('leave done', () => r.done.leave())
        await r.step('show', () => (r.data.value.show = true))
      },
    )
    expect(steps).toEqual([
      'mount: <div>c</div> | ',
      'hide: <div>c</div> | beforeLeave:c leave:c',
      'leave done: <div style="display: none;">c</div> | afterLeave:c',
      'show: <div style="">c</div> | beforeEnter:c enter:c',
    ])
  })

  test('a KeepAlive root switched by the child under out-in', async () => {
    const steps = await parity(
      around(`mode="out-in" ${hooks}`),
      `<KeepAlive><component :is="data.show ? components.A : components.B"/></KeepAlive>`,
      async r => {
        await r.step('swap', () => (r.data.value.show = false))
        await r.step('enter done', () => r.done.enter())
      },
      { A: '<div>a</div>', B: '<p>b</p>' },
    )
    expect(steps[1]).toBe(
      'swap: <p>b</p> | beforeLeave:a leave:a afterLeave:a beforeEnter:b enter:b',
    )
  })
})
