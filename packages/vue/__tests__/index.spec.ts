import { BindingTypes, type CompilerOptions } from '@vue/compiler-core'
import { compile } from '@vue/compiler-dom'
import { EMPTY_ARR } from '@vue/shared'
import { type VNode, createApp, nextTick, reactive, ref } from '../src'
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
})
