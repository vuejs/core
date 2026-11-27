// cross-checks that a falsy `class` value in a render function produces the
// same result on the server and on the client.
// `class: cond && 'active'` is a common render-function / JSX pattern; SSR
// (`ssrRenderClass`) and the hydration mismatch check (`propHasMismatch`)
// both run the value through `normalizeClass`, so the client patch must not
// end up writing the literal string "false" / "0" as a class.
import { createApp, createSSRApp, h, nextTick, ref } from 'vue'
import { renderToString } from '@vue/server-renderer'

describe('falsy class value: CSR vs SSR vs hydration', () => {
  const App = {
    setup() {
      const active = ref(false)
      return { active }
    },
    render(this: any) {
      return h('div', { class: this.active && 'active' }, 'hello')
    },
  }

  test('client render does not write "false" as a class', () => {
    const root = document.createElement('div')
    createApp(App).mount(root)
    expect((root.firstElementChild as HTMLElement).className).toBe('')
  })

  test('server render agrees with the client', async () => {
    const html = await renderToString(h(App))
    expect(html).toBe('<div class="">hello</div>')
  })

  test('hydration + subsequent update stays consistent', async () => {
    const html = await renderToString(h(App))
    const root = document.createElement('div')
    root.innerHTML = html
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const app = createSSRApp(App)
    const vm = app.mount(root) as any
    await nextTick()
    const warnings = warnSpy.mock.calls
      .map(c => String(c[0]))
      .filter(m => m.includes('Hydration'))
    warnSpy.mockRestore()
    expect(warnings).toEqual([])
    // a later re-render must not write the literal "false" class either
    vm.active = true
    await nextTick()
    expect((root.firstElementChild as HTMLElement).className).toBe('active')
    vm.active = false
    await nextTick()
    expect((root.firstElementChild as HTMLElement).className).toBe('')
  })
})
