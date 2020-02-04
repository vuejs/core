import { h, reactive, createApp, ref } from 'vue'
import { CompilerOptions } from '@vue/compiler-dom'

export const ssrMode = ref(false)

export const compilerOptions: CompilerOptions = reactive({
  mode: 'module',
  prefixIdentifiers: false,
  hoistStatic: false,
  cacheHandlers: false,
  scopeId: null
})

const App = {
  setup() {
    return () => {
      const isSSR = ssrMode.value
      const isModule = compilerOptions.mode === 'module'
      const usePrefix =
        compilerOptions.prefixIdentifiers || compilerOptions.mode === 'module'

      return [
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
              checked: isModule,
              onChange() {
                compilerOptions.mode = 'module'
              }
            }),
            h('label', { for: 'mode-module' }, 'module'),
            h('input', {
              type: 'radio',
              id: 'mode-function',
              name: 'mode',
              checked: !isModule,
              onChange() {
                compilerOptions.mode = 'function'
              }
            }),
            h('label', { for: 'mode-function' }, 'function')
          ]),

          // SSR
          h('input', {
            type: 'checkbox',
            id: 'ssr',
            name: 'ssr',
            checked: ssrMode.value,
            onChange(e: Event) {
              ssrMode.value = (e.target as HTMLInputElement).checked
            }
          }),
          h('label', { for: 'ssr' }, 'SSR'),

          // toggle prefixIdentifiers
          h('input', {
            type: 'checkbox',
            id: 'prefix',
            disabled: isModule || isSSR,
            checked: usePrefix || isSSR,
            onChange(e: Event) {
              compilerOptions.prefixIdentifiers =
                (e.target as HTMLInputElement).checked || isModule
            }
          }),
          h('label', { for: 'prefix' }, 'prefixIdentifiers'),

          // toggle hoistStatic
          h('input', {
            type: 'checkbox',
            id: 'hoist',
            checked: compilerOptions.hoistStatic && !isSSR,
            disabled: isSSR,
            onChange(e: Event) {
              compilerOptions.hoistStatic = (e.target as HTMLInputElement).checked
            }
          }),
          h('label', { for: 'hoist' }, 'hoistStatic'),

          // toggle cacheHandlers
          h('input', {
            type: 'checkbox',
            id: 'cache',
            checked: usePrefix && compilerOptions.cacheHandlers && !isSSR,
            disabled: !usePrefix || isSSR,
            onChange(e: Event) {
              compilerOptions.cacheHandlers = (e.target as HTMLInputElement).checked
            }
          }),
          h('label', { for: 'cache' }, 'cacheHandlers'),

          // toggle scopeId
          h('input', {
            type: 'checkbox',
            id: 'scope-id',
            disabled: !isModule,
            checked: isModule && compilerOptions.scopeId,
            onChange(e: Event) {
              compilerOptions.scopeId =
                isModule && (e.target as HTMLInputElement).checked
                  ? 'scope-id'
                  : null
            }
          }),
          h('label', { for: 'scope-id' }, 'scopeId')
        ])
      ]
    }
  }
}

export function initOptions() {
  createApp(App).mount(document.getElementById('header')!)
}
