import { h, reactive, createApp } from '@vue/runtime-dom'
import { CompilerOptions } from '@vue/compiler-dom'

export const compilerOptions: CompilerOptions = reactive({
  mode: 'module',
  prefixIdentifiers: false,
  hoistStatic: false,
  cacheHandlers: false
})

const App = {
  setup() {
    return () => [
      h('h1', `Vue 3 Template Explorer`),
      h(
        'a',
        {
          href: `https://github.com/vuejs/vue-next/tree/${__COMMIT__}`,
          target: `_blank`
        },
        `@${__COMMIT__}`
      ),
      h('div', { id: 'options' }, [
        // mode selection
        h('span', { class: 'options-group' }, [
          h('span', { class: 'label' }, 'Mode:'),
          h('input', {
            type: 'radio',
            id: 'mode-module',
            name: 'mode',
            checked: compilerOptions.mode === 'module',
            onChange() {
              compilerOptions.mode = 'module'
            }
          }),
          h('label', { for: 'mode-module' }, 'module'),
          h('input', {
            type: 'radio',
            id: 'mode-function',
            name: 'mode',
            checked: compilerOptions.mode === 'function',
            onChange() {
              compilerOptions.mode = 'function'
            }
          }),
          h('label', { for: 'mode-function' }, 'function')
        ]),

        // toggle prefixIdentifiers
        h('input', {
          type: 'checkbox',
          id: 'prefix',
          disabled: compilerOptions.mode === 'module',
          checked:
            compilerOptions.prefixIdentifiers ||
            compilerOptions.mode === 'module',
          onChange(e: Event) {
            compilerOptions.prefixIdentifiers =
              (<HTMLInputElement>e.target).checked ||
              compilerOptions.mode === 'module'
          }
        }),
        h('label', { for: 'prefix' }, 'prefixIdentifiers'),

        // toggle hoistStatic
        h('input', {
          type: 'checkbox',
          id: 'hoist',
          checked: compilerOptions.hoistStatic,
          onChange(e: Event) {
            compilerOptions.hoistStatic = (<HTMLInputElement>e.target).checked
          }
        }),
        h('label', { for: 'hoist' }, 'hoistStatic'),

        // toggle cacheHandlers
        h('input', {
          type: 'checkbox',
          id: 'cache',
          checked:
            compilerOptions.cacheHandlers && compilerOptions.prefixIdentifiers,
          disabled: !compilerOptions.prefixIdentifiers,
          onChange(e: Event) {
            compilerOptions.cacheHandlers = (<HTMLInputElement>e.target).checked
          }
        }),
        h('label', { for: 'cache' }, 'cacheHandlers')
      ])
    ]
  }
}

export function initOptions() {
  createApp().mount(App, document.getElementById('header')!)
}
