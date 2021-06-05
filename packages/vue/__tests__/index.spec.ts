import { EMPTY_ARR } from '@vue/shared'
import { createApp, ref, nextTick, reactive } from '../src'

describe('compiler + runtime integration', () => {
  it('should support runtime template compilation', () => {
    const container = document.createElement('div')
    const App = {
      template: `{{ count }}`,
      data() {
        return {
          count: 0
        }
      }
    }
    createApp(App).mount(container)
    expect(container.innerHTML).toBe(`0`)
  })

  it('keep-alive with compiler + runtime integration', async () => {
    const container = document.createElement('div')
    const one = {
      name: 'one',
      template: 'one',
      created: jest.fn(),
      mounted: jest.fn(),
      activated: jest.fn(),
      deactivated: jest.fn(),
      unmounted: jest.fn()
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
          toggle
        }
      },
      components: {
        One: one
      }
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
          count: 0
        }
      }
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
          count: 0
        }
      }
    }
    createApp(App).mount(container)
    expect(container.innerHTML).toBe(`0`)
  })

  it('should warn template compilation errors with codeframe', () => {
    const container = document.createElement('div')
    const App = {
      template: `<div v-if>`
    }
    createApp(App).mount(container)
    expect(
      `Template compilation error: Element is missing end tag`
    ).toHaveBeenWarned()
    expect(
      `
1  |  <div v-if>
   |  ^`.trim()
    ).toHaveBeenWarned()
    expect(`v-if/v-else-if is missing expression`).toHaveBeenWarned()
    expect(
      `
1  |  <div v-if>
   |       ^^^^`.trim()
    ).toHaveBeenWarned()
  })

  it('should support custom element', () => {
    const app = createApp({
      template: '<custom></custom>'
    })
    const container = document.createElement('div')
    app.config.isCustomElement = tag => tag === 'custom'
    app.mount(container)
    expect(container.innerHTML).toBe('<custom></custom>')
  })

  it('should support using element innerHTML as template', () => {
    const app = createApp({
      data: () => ({
        msg: 'hello'
      })
    })
    const container = document.createElement('div')
    container.innerHTML = '{{msg}}'
    app.mount(container)
    expect(container.innerHTML).toBe('hello')
  })

  it('should support selector of rootContainer', () => {
    const container = document.createElement('div')
    const origin = document.querySelector
    document.querySelector = jest.fn().mockReturnValue(container)

    const App = {
      template: `{{ count }}`,
      data() {
        return {
          count: 0
        }
      }
    }
    createApp(App).mount('#app')
    expect(container.innerHTML).toBe(`0`)
    document.querySelector = origin
  })

  it('should warn when template is not available', () => {
    const app = createApp({
      template: {}
    })
    const container = document.createElement('div')
    app.mount(container)
    expect('[Vue warn]: invalid template option:').toHaveBeenWarned()
  })

  it('should warn when template is is not found', () => {
    const app = createApp({
      template: '#not-exist-id'
    })
    const container = document.createElement('div')
    app.mount(container)
    expect(
      '[Vue warn]: Template element not found or is empty: #not-exist-id'
    ).toHaveBeenWarned()
  })

  it('should warn when container is not found', () => {
    const origin = document.querySelector
    document.querySelector = jest.fn().mockReturnValue(null)
    const App = {
      template: `{{ count }}`,
      data() {
        return {
          count: 0
        }
      }
    }
    createApp(App).mount('#not-exist-id')

    expect(
      '[Vue warn]: Failed to mount app: mount target selector "#not-exist-id" returned null.'
    ).toHaveBeenWarned()
    document.querySelector = origin
  })

  // #1813
  it('should not report an error when "0" as patchFlag value', async () => {
    const container = document.createElement('div')
    const target = document.createElement('div')
    const count = ref(0)
    const origin = document.querySelector
    document.querySelector = jest.fn().mockReturnValue(target)

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
          count
        }
      }
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
      template: `<div>{{ ok }}<div v-if="ok" v-once>{{ ok }}</div></div>`
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
      template: `<div>{{ list.length }}<div v-for="i in list" v-once>{{ i }}</div></div>`
    }
    const container = document.createElement('div')
    createApp(App).mount(container)

    expect(container.innerHTML).toBe(`<div>1<div>1</div></div>`)
    list.push(2)
    await nextTick()
    expect(container.innerHTML).toBe(`<div>2<div>1</div></div>`)
  })

  // #2413
  it('EMPTY_ARR should not change', () => {
    const App = {
      template: `<div v-for="v of ['a']">{{ v }}</div>`
    }
    const container = document.createElement('div')
    createApp(App).mount(container)
    expect(EMPTY_ARR.length).toBe(0)
  })

  test('BigInt support', () => {
    const app = createApp({
      template: `<div>{{ BigInt(BigInt(100000111)) + BigInt(2000000000n) * 30000000n }}</div>`
    })
    const root = document.createElement('div')
    app.mount(root)
    expect(root.innerHTML).toBe('<div>60000000100000111</div>')
  })
})
