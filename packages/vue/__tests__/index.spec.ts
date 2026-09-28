import { BindingTypes, type CompilerOptions } from '@vue/compiler-core'
import { compile } from '@vue/compiler-dom'
import { EMPTY_ARR } from '@vue/shared'
import { type VNode, createApp, h, nextTick, reactive, ref } from '../src'
import * as Vue from '../src'
import type { InternalRenderFunction } from '../../runtime-core/src/component'

function compileToFunction(template: string, options?: CompilerOptions) {
  const { code } = compile(template, {
    hoistStatic: true,
    ...options,
  })
  const render = new Function('Vue', code)(Vue) as InternalRenderFunction
  render._rc = true
  return render
}

describe('compiler + runtime integration', () => {
  it('should support runtime template compilation', () => {
    const container = document.createElement('div')
    const App = {
      template: `{{ count }}`,
      data() {
        return {
          count: 0,
        }
      },
    }
    createApp(App).mount(container)
    expect(container.innerHTML).toBe(`0`)
  })

  it('keep-alive with compiler + runtime integration', async () => {
    const container = document.createElement('div')
    const one = {
      name: 'one',
      template: 'one',
      created: vi.fn(),
      mounted: vi.fn(),
      activated: vi.fn(),
      deactivated: vi.fn(),
      unmounted: vi.fn(),
    }

    const toggle = ref(true)

    const App = {
      template: `
        <keep-alive>
          <one v-if="toggle"></one>
        </keep-alive>
      `,
      data() {
        return {
          toggle,
        }
      },
      components: {
        One: one,
      },
    }
    createApp(App).mount(container)
    expect(container.innerHTML).toBe(`one`)
    expect(one.created).toHaveBeenCalledTimes(1)
    expect(one.mounted).toHaveBeenCalledTimes(1)
    expect(one.activated).toHaveBeenCalledTimes(1)
    expect(one.deactivated).toHaveBeenCalledTimes(0)
    expect(one.unmounted).toHaveBeenCalledTimes(0)

    toggle.value = false
    await nextTick()
    expect(container.innerHTML).toBe(`<!--v-if-->`)
    expect(one.created).toHaveBeenCalledTimes(1)
    expect(one.mounted).toHaveBeenCalledTimes(1)
    expect(one.activated).toHaveBeenCalledTimes(1)
    expect(one.deactivated).toHaveBeenCalledTimes(1)
    expect(one.unmounted).toHaveBeenCalledTimes(0)

    toggle.value = true
    await nextTick()
    expect(container.innerHTML).toBe(`one`)
    expect(one.created).toHaveBeenCalledTimes(1)
    expect(one.mounted).toHaveBeenCalledTimes(1)
    expect(one.activated).toHaveBeenCalledTimes(2)
    expect(one.deactivated).toHaveBeenCalledTimes(1)
    expect(one.unmounted).toHaveBeenCalledTimes(0)
  })

  it('should support runtime template via CSS ID selector', () => {
    const container = document.createElement('div')
    const template = document.createElement('div')
    template.id = 'template'
    template.innerHTML = '{{ count }}'
    document.body.appendChild(template)

    const App = {
      template: `#template`,
      data() {
        return {
          count: 0,
        }
      },
    }
    createApp(App).mount(container)
    expect(container.innerHTML).toBe(`0`)
  })

  it('should support runtime template via direct DOM node', () => {
    const container = document.createElement('div')
    const template = document.createElement('div')
    template.id = 'template'
    template.innerHTML = '{{ count }}'

    const App = {
      template,
      data() {
        return {
          count: 0,
        }
      },
    }
    createApp(App).mount(container)
    expect(container.innerHTML).toBe(`0`)
  })

  it('should warn template compilation errors with codeframe', () => {
    const container = document.createElement('div')
    const App = {
      template: `<div v-if>`,
    }
    createApp(App).mount(container)
    expect(
      `Template compilation error: Element is missing end tag`,
    ).toHaveBeenWarned()
    expect(
      `
1  |  <div v-if>
   |  ^`.trim(),
    ).toHaveBeenWarned()
    expect(`v-if/v-else-if is missing expression`).toHaveBeenWarned()
    expect(
      `
1  |  <div v-if>
   |       ^^^^`.trim(),
    ).toHaveBeenWarned()
  })

  it('should support custom element via config.isCustomElement (deprecated)', () => {
    const app = createApp({
      template: '<custom></custom>',
    })
    const container = document.createElement('div')
    app.config.isCustomElement = tag => tag === 'custom'
    app.mount(container)
    expect(container.innerHTML).toBe('<custom></custom>')
  })

  it('should support custom element via config.compilerOptions.isCustomElement', () => {
    const app = createApp({
      template: '<custom></custom>',
    })
    const container = document.createElement('div')
    app.config.compilerOptions.isCustomElement = tag => tag === 'custom'
    app.mount(container)
    expect(container.innerHTML).toBe('<custom></custom>')
  })

  it('should support using element innerHTML as template', () => {
    const app = createApp({
      data: () => ({
        msg: 'hello',
      }),
    })
    const container = document.createElement('div')
    container.innerHTML = '{{msg}}'
    app.mount(container)
    expect(container.innerHTML).toBe('hello')
  })

  it('should support selector of rootContainer', () => {
    const container = document.createElement('div')
    const origin = document.querySelector
    document.querySelector = vi.fn().mockReturnValue(container)

    const App = {
      template: `{{ count }}`,
      data() {
        return {
          count: 0,
        }
      },
    }
    createApp(App).mount('#app')
    expect(container.innerHTML).toBe(`0`)
    document.querySelector = origin
  })

  it('should warn when template is not available', () => {
    const app = createApp({
      template: {},
    })
    const container = document.createElement('div')
    app.mount(container)
    expect('[Vue warn]: invalid template option:').toHaveBeenWarned()
  })

  it('should warn when template is not found', () => {
    const app = createApp({
      template: '#not-exist-id',
    })
    const container = document.createElement('div')
    app.mount(container)
    expect(
      '[Vue warn]: Template element not found or is empty: #not-exist-id',
    ).toHaveBeenWarned()
  })

  it('should warn when container is not found', () => {
    const origin = document.querySelector
    document.querySelector = vi.fn().mockReturnValue(null)
    const App = {
      template: `{{ count }}`,
      data() {
        return {
          count: 0,
        }
      },
    }
    createApp(App).mount('#not-exist-id')

    expect(
      '[Vue warn]: Failed to mount app: mount target selector "#not-exist-id" returned null.',
    ).toHaveBeenWarned()
    document.querySelector = origin
  })

  // #1813
  it('should not report an error when "0" as patchFlag value', async () => {
    const container = document.createElement('div')
    const target = document.createElement('div')
    const count = ref(0)
    const origin = document.querySelector
    document.querySelector = vi.fn().mockReturnValue(target)

    const App = {
      template: `
      <teleport v-if="count < 2" to="#target">
        <div>
          <div>{{ count }}</div>
        </div>
      </teleport>
      `,
      data() {
        return {
          count,
        }
      },
    }
    createApp(App).mount(container)
    expect(container.innerHTML).toBe(`<!--teleport start--><!--teleport end-->`)
    expect(target.innerHTML).toBe(`<div><div>0</div></div>`)

    count.value++
    await nextTick()
    expect(container.innerHTML).toBe(`<!--teleport start--><!--teleport end-->`)
    expect(target.innerHTML).toBe(`<div><div>1</div></div>`)

    count.value++
    await nextTick()
    expect(container.innerHTML).toBe(`<!--v-if-->`)
    expect(target.innerHTML).toBe(``)

    document.querySelector = origin
  })

  test('v-if + v-once', async () => {
    const ok = ref(true)
    const App = {
      setup() {
        return { ok }
      },
      template: `<div>{{ ok }}<div v-if="ok" v-once>{{ ok }}</div></div>`,
    }
    const container = document.createElement('div')
    createApp(App).mount(container)

    expect(container.innerHTML).toBe(`<div>true<div>true</div></div>`)
    ok.value = false
    await nextTick()
    expect(container.innerHTML).toBe(`<div>false<div>true</div></div>`)
  })

  test.each([
    '<div><Child v-once />{{ count }}</div>',
    '<Child v-once />{{ count }}',
  ])('unmounts a v-once child after rerendering: %s', async template => {
    const count = ref(0)
    const unmounted = vi.fn()
    const container = document.createElement('div')
    const app = createApp({
      components: {
        Child: { template: 'child', unmounted },
      },
      setup: () => ({ count }),
      template,
    })

    app.mount(container)
    expect(container.textContent).toBe('child0')
    count.value++
    await nextTick()
    expect(container.textContent).toBe('child1')

    app.unmount()
    expect(unmounted).toHaveBeenCalledTimes(1)
  })

  test.each([0, 1])(
    'preserves cached slot content after removing outlet %i',
    async removeIndex => {
      const show = ref(true)
      const count = ref(0)
      const tick = ref(0)
      const unmounted = vi.fn()
      let id = 0
      const container = document.createElement('div')
      const app = createApp({
        components: {
          Child: {
            props: ['value'],
            data: () => ({ id: ++id }),
            template: '<p>{{ value }}</p>',
            unmounted() {
              unmounted(this.id)
            },
          },
          Twice: {
            setup(_, { slots }) {
              return () => {
                tick.value
                return Vue.h(
                  'div',
                  ['section', 'aside'].map((tag, index) =>
                    show.value || index !== removeIndex
                      ? Vue.h(tag, slots.default!())
                      : null,
                  ),
                )
              }
            },
          },
        },
        setup: () => ({ count }),
        template: '<Twice><Child v-once :value="count" /></Twice>',
      })

      app.mount(container)
      expect(container.textContent).toBe('00')
      show.value = false
      await nextTick()
      expect(container.textContent).toBe('0')
      expect(unmounted).toHaveBeenCalledTimes(1)
      expect(unmounted).toHaveBeenLastCalledWith(removeIndex + 1)
      count.value++
      tick.value++
      await nextTick()
      expect(container.textContent).toBe('0')
      show.value = true
      await nextTick()
      expect(container.textContent).toBe('00')
      app.unmount()
      expect(unmounted.mock.calls.map(([id]) => id).sort()).toEqual([1, 2, 3])
    },
  )

  test('does not clear the receiver cache when a cloned v-once slot unmounts', async () => {
    const show = ref(true)
    const count = ref(0)
    const container = document.createElement('div')
    const app = createApp({
      components: {
        Child: { template: 'child' },
        Twice: {
          components: {
            OwnChild: { props: ['value'], template: '<p>{{ value }}</p>' },
          },
          setup: () => ({ count, show }),
          template:
            '<div><OwnChild v-once :value="count" /><slot /><slot v-if="show" /><b>{{ count }}</b></div>',
        },
      },
      setup: () => ({ enabled: true }),
      template:
        '<Twice><template #default v-if="enabled"><Child v-once /></template></Twice>',
    })

    app.mount(container)
    show.value = false
    await nextTick()
    count.value++
    await nextTick()
    expect(container.querySelector('p')!.textContent).toBe('0')
    expect(container.querySelector('b')!.textContent).toBe('1')
    app.unmount()
  })

  test('v-for + v-once', async () => {
    const list = reactive([1])
    const App = {
      setup() {
        return { list }
      },
      template: `<div>{{ list.length }}<div v-for="i in list" v-once>{{ i }}</div></div>`,
    }
    const container = document.createElement('div')
    createApp(App).mount(container)

    expect(container.innerHTML).toBe(`<div>1<div>1</div></div>`)
    list.push(2)
    await nextTick()
    expect(container.innerHTML).toBe(`<div>2<div>1</div></div>`)
  })

  test('nullish v-bind on <slot>', async () => {
    const Child = {
      props: ['error', 'value'],
      template:
        `<div>` +
        `<template v-if="error">{{ error }}</template>` +
        `<template v-else><slot v-bind="value" name="scoped">fallback</slot></template>` +
        `</div>`,
    }

    const fallbackContainer = document.createElement('div')
    createApp({
      components: { Child },
      template: `<Child :error="null" :value="null"/>`,
    }).mount(fallbackContainer)
    expect(fallbackContainer.innerHTML).toBe(`<div>fallback</div>`)

    const value = ref<{ label: string } | null>(null)
    const container = document.createElement('div')
    createApp({
      components: { Child },
      setup() {
        return { value }
      },
      template:
        `<Child :error="null" :value="value">` +
        `<template #scoped="{ label }">{{ label || 'none' }}</template>` +
        `</Child>`,
    }).mount(container)
    expect(container.innerHTML).toBe(`<div>none</div>`)

    value.value = { label: 'foo' }
    await nextTick()
    expect(container.innerHTML).toBe(`<div>foo</div>`)
  })

  // #2413
  it('EMPTY_ARR should not change', () => {
    const App = {
      template: `<div v-for="v of ['a']">{{ v }}</div>`,
    }
    const container = document.createElement('div')
    createApp(App).mount(container)
    expect(EMPTY_ARR.length).toBe(0)
  })

  test('BigInt support', () => {
    const app = createApp({
      template: `<div>{{ BigInt(BigInt(100000111)) + BigInt(2000000000n) * 30000000n }}</div>`,
    })
    const root = document.createElement('div')
    app.mount(root)
    expect(root.innerHTML).toBe('<div>60000000100000111</div>')
  })

  describe('stable v-for lifecycle', () => {
    test('clears static ref arrays on branch removal', async () => {
      const show = ref(true)
      const items = ref<HTMLElement[]>([])
      const app = createApp({
        setup: () => ({ items, show }),
        render: compileToFunction(
          `<template v-if="show"><div v-for="i in 3" :key="i" ref="items" /></template>`,
          { prefixIdentifiers: true },
        ),
      })
      const container = document.createElement('div')

      app.mount(container)
      expect(items.value).toHaveLength(3)

      show.value = false
      await nextTick()
      expect(items.value).toHaveLength(0)

      app.unmount()
    })

    test('calls setup-const function refs with null on branch removal', async () => {
      const show = ref(true)
      const values: (Element | null)[] = []
      const setRef = (value: Element | null) => values.push(value)
      const app = createApp({
        setup: () => ({ setRef, show }),
        render: compileToFunction(
          `<template v-if="show"><div v-for="i in 1" :ref="setRef" /></template>`,
          {
            prefixIdentifiers: true,
            bindingMetadata: {
              setRef: BindingTypes.SETUP_CONST,
            },
          },
        ),
      })
      const container = document.createElement('div')

      app.mount(container)
      expect(values).toHaveLength(1)
      expect(values[0]).toBeInstanceOf(HTMLDivElement)

      show.value = false
      await nextTick()
      expect(values).toHaveLength(2)
      expect(values[1]).toBeNull()

      app.unmount()
    })

    test('calls directive unmounted hooks on branch removal', async () => {
      const show = ref(true)
      const unmounted = vi.fn()
      const app = createApp({
        directives: { dir: { unmounted } },
        setup: () => ({ show }),
        render: compileToFunction(
          `<template v-if="show"><div v-for="i in 1" v-dir /></template>`,
          { prefixIdentifiers: true },
        ),
      })
      const container = document.createElement('div')

      app.mount(container)
      show.value = false
      await nextTick()
      expect(unmounted).toHaveBeenCalledOnce()

      app.unmount()
    })

    test('calls vnode unmounted hooks on branch removal', async () => {
      const show = ref(true)
      const onVnodeUnmounted = vi.fn()
      const app = createApp({
        setup: () => ({ onVnodeUnmounted, show }),
        render: compileToFunction(
          `<template v-if="show"><div v-for="i in 1" @vue:unmounted="onVnodeUnmounted" /></template>`,
          { prefixIdentifiers: true },
        ),
      })
      const container = document.createElement('div')

      app.mount(container)
      show.value = false
      await nextTick()
      expect(onVnodeUnmounted).toHaveBeenCalledOnce()

      app.unmount()
    })

    test('runs directive beforeUpdate before child updates', async () => {
      const value = ref('old')
      const observed: string[] = []
      const app = createApp({
        directives: {
          dir: {
            beforeUpdate(el: HTMLElement) {
              observed.push(el.textContent!)
            },
          },
        },
        setup: () => ({ value }),
        render: compileToFunction(
          `<div v-for="i in 1" v-dir>{{ value }}</div>`,
          { prefixIdentifiers: true },
        ),
      })
      const container = document.createElement('div')

      app.mount(container)
      value.value = 'new'
      await nextTick()
      expect(observed).toEqual(['old'])

      app.unmount()
    })

    test('runs vnode beforeUpdate before nested child updates', async () => {
      const value = ref('old')
      const observed: string[] = []
      const onVnodeBeforeUpdate = (vnode: VNode) => {
        observed.push((vnode.el as HTMLElement).textContent!)
      }
      const app = createApp({
        setup: () => ({ onVnodeBeforeUpdate, value }),
        render: compileToFunction(
          `<div v-for="i in 1" @vue:beforeUpdate="onVnodeBeforeUpdate"><span>{{ value }}</span></div>`,
          { prefixIdentifiers: true },
        ),
      })
      const container = document.createElement('div')

      app.mount(container)
      value.value = 'new'
      await nextTick()
      expect(observed).toEqual(['old'])

      app.unmount()
    })
  })

  test.each([false, true])(
    'unmounts all children of a nested v-once block (updated: %s)',
    async updated => {
      const count = ref(0)
      const onceUnmounted = vi.fn()
      const liveUnmounted = vi.fn()
      const container = document.createElement('div')
      const app = createApp({
        components: {
          OnceChild: { template: 'once', unmounted: onceUnmounted },
          LiveChild: { template: 'live', unmounted: liveUnmounted },
        },
        setup: () => ({ count, show: true }),
        template:
          '<div><section v-if="show"><OnceChild v-once /><LiveChild />{{ count }}</section></div>',
      })

      app.mount(container)
      expect(container.textContent).toBe('oncelive0')
      if (updated) {
        count.value++
        await nextTick()
        expect(container.textContent).toBe('oncelive1')
      }

      app.unmount()
      expect({
        once: onceUnmounted.mock.calls.length,
        live: liveUnmounted.mock.calls.length,
      }).toEqual({ once: 1, live: 1 })
    },
  )

  describe('vnodes picked from a manually invoked compiled slot (#3569)', () => {
    // renders the vnode at `index` of its default slot
    const Picker = {
      props: ['index'],
      setup(props: any, { slots }: any) {
        return () => h('div', slots.default()[props.index])
      },
    }

    function mountPicker(template: string, components = {}, state = {}) {
      const index = ref(0)
      const container = document.createElement('div')
      createApp({
        components: { Picker, ...components },
        setup: () => ({ index, ...state }),
        template: `<Picker :index="index">${template}</Picker>`,
      }).mount(container)
      return { index, container }
    }

    test('elements with different static props', async () => {
      const { index, container } = mountPicker(
        `<p class="a" :id="id">A</p><p class="b" :id="id">B</p>`,
        {},
        { id: 'x' },
      )
      expect(container.innerHTML).toBe(`<div><p class="a" id="x">A</p></div>`)
      index.value = 1
      await nextTick()
      expect(container.innerHTML).toBe(`<div><p class="b" id="x">B</p></div>`)
      index.value = 0
      await nextTick()
      expect(container.innerHTML).toBe(`<div><p class="a" id="x">A</p></div>`)
    })

    test('components rendering the slot via <slot>', async () => {
      const Bar = { template: `<slot/>` }
      const { index, container } = mountPicker(
        `<Bar><p v-if="true">1</p></Bar>` +
          `<Bar><p v-if="true">2</p></Bar>` +
          `<Bar><p>3</p></Bar>`,
        { Bar },
      )
      expect(container.innerHTML).toBe(`<div><p>1</p></div>`)
      for (const expected of ['2', '3', '1', '2']) {
        index.value = (index.value + 1) % 3
        await nextTick()
        expect(container.innerHTML).toBe(`<div><p>${expected}</p></div>`)
      }
    })

    test('slot content keeps updating after being swapped', async () => {
      const msg = ref('a')
      const Bar = { template: `<slot/><hr><slot/>` }
      const { index, container } = mountPicker(
        `<Bar><p v-if="true" class="a"><i>A</i>{{ msg }}</p></Bar>` +
          `<Bar><p v-if="true" class="b"><b>B</b>{{ msg }}</p></Bar>`,
        { Bar },
        { msg },
      )
      const render = (html: string) => `<div>${html}<hr>${html}</div>`

      index.value = 1
      await nextTick()
      expect(container.innerHTML).toBe(render(`<p class="b"><b>B</b>a</p>`))
      msg.value = 'b'
      await nextTick()
      expect(container.innerHTML).toBe(render(`<p class="b"><b>B</b>b</p>`))
      index.value = 0
      await nextTick()
      expect(container.innerHTML).toBe(render(`<p class="a"><i>A</i>b</p>`))
      msg.value = 'c'
      await nextTick()
      expect(container.innerHTML).toBe(render(`<p class="a"><i>A</i>c</p>`))
    })

    test('slot forwarded through nested components', async () => {
      const msg = ref('a')
      const Card = { template: `<section><slot/></section>` }
      const Bar = { components: { Card }, template: `<Card><slot/></Card>` }
      const { index, container } = mountPicker(
        `<Bar><Card><p v-if="true" class="a"><i>A</i>{{ msg }}</p></Card></Bar>` +
          `<Bar><Card><p v-if="true" class="b"><b>B</b>{{ msg }}</p></Card></Bar>`,
        { Bar, Card },
        { msg },
      )

      index.value = 1
      await nextTick()
      expect(container.innerHTML).toBe(
        `<div><section><section><p class="b"><b>B</b>a</p></section></section></div>`,
      )
      msg.value = 'b'
      await nextTick()
      expect(container.innerHTML).toBe(
        `<div><section><section><p class="b"><b>B</b>b</p></section></section></div>`,
      )
      index.value = 0
      await nextTick()
      expect(container.innerHTML).toBe(
        `<div><section><section><p class="a"><i>A</i>b</p></section></section></div>`,
      )
    })

    test('keyed v-for with overlapping keys', async () => {
      const Bar = { template: `<ul><slot/></ul>` }
      const { index, container } = mountPicker(
        `<Bar><li v-for="i in 2" :key="i" class="a"><i>{{ i }}</i></li></Bar>` +
          `<Bar><li v-for="i in 3" :key="i" class="b"><b>{{ i }}</b></li></Bar>`,
        { Bar },
      )
      index.value = 1
      await nextTick()
      expect(container.innerHTML).toBe(
        `<div><ul>` +
          `<li class="b"><b>1</b></li><li class="b"><b>2</b></li><li class="b"><b>3</b></li>` +
          `</ul></div>`,
      )
      index.value = 0
      await nextTick()
      expect(container.innerHTML).toBe(
        `<div><ul><li class="a"><i>1</i></li><li class="a"><i>2</i></li></ul></div>`,
      )
    })

    test('<component :is> in a template', async () => {
      const index = ref(0)
      const Foo = {
        setup: () => ({ index }),
        template: `<div><component :is="$slots.default()[index]" /></div>`,
      }
      const Bar = { template: `<slot/>` }
      const container = document.createElement('div')
      createApp({
        components: { Foo, Bar },
        template:
          `<Foo><Bar><p v-if="true" class="a">1</p></Bar>` +
          `<Bar><p v-if="true" class="b">2</p></Bar></Foo>`,
      }).mount(container)

      index.value = 1
      await nextTick()
      expect(container.innerHTML).toBe(`<div><p class="b">2</p></div>`)
      index.value = 0
      await nextTick()
      expect(container.innerHTML).toBe(`<div><p class="a">1</p></div>`)
    })
  })

  // #3569
  test('compiled slots swapped by a render function', async () => {
    const swapped = ref(false)
    const Bar = { template: `<header><slot name="header"/></header><slot/>` }
    const Foo = {
      setup(_: any, { slots }: any) {
        return () =>
          h(Bar, null, {
            header: swapped.value ? slots.b : slots.a,
            default: swapped.value ? slots.a : slots.b,
          })
      },
    }
    const container = document.createElement('div')
    createApp({
      components: { Foo },
      template:
        `<Foo><template #a><p v-if="true" class="a">A</p></template>` +
        `<template #b><p v-if="true" class="b"><i>B</i></p></template></Foo>`,
    }).mount(container)

    const a = `<p class="a">A</p>`
    const b = `<p class="b"><i>B</i></p>`
    expect(container.innerHTML).toBe(`<header>${a}</header>${b}`)
    swapped.value = true
    await nextTick()
    expect(container.innerHTML).toBe(`<header>${b}</header>${a}`)
    swapped.value = false
    await nextTick()
    expect(container.innerHTML).toBe(`<header>${a}</header>${b}`)
  })

  // #3569
  test('compiled slots forwarded unchanged by a render function stay optimized', async () => {
    const count = ref(0)
    const Bar = { props: ['count'], template: `<slot/>{{ count }}` }
    const Foo = {
      setup(_: any, { slots }: any) {
        return () => h(Bar, { count: count.value }, { default: slots.default })
      },
    }
    const container = document.createElement('div')
    const vm = createApp({
      components: { Foo },
      template: `<Foo><p v-if="true">{{ 'p' }}</p></Foo>`,
    }).mount(container)
    const bar = (vm.$.subTree.component!.subTree as VNode).component!

    count.value++
    await nextTick()
    expect(container.innerHTML).toBe(`<p>p</p>1`)
    // Bar was updated by its parent with the same compiled slot, so the slot
    // content is still rendered as a block
    const slotFragment = (bar.subTree.children as VNode[])[0]
    const p = (slotFragment.children as VNode[])[0]
    expect(p.dynamicChildren).not.toBe(null)
  })
})
