import { computed, createSSRApp, defineComponent, h, reactive } from 'vue'
import { renderToString } from '../src/renderToString'

// #5208 reported memory leak of keeping computed alive during SSR
// so we made computed properties created during SSR non-reactive in
// https://github.com/vuejs/core/commit/f4f0966b33863ac0fca6a20cf9e8ddfbb311ae87
// However, the default caching leads to #5300 which is tested below.
// In Vue 2, computed properties are simple getters during SSR - this can be
// inefficient if an expensive computed is accessed multiple times during render,
// but because of potential mutations, we cannot cache it until we enter the
// render phase (where no mutations can happen anymore)
test('computed reactivity during SSR', async () => {
  const store = {
    // initial state could be hydrated
    state: reactive({ items: null }) as any,

    // pretend to fetch some data from an api
    async fetchData() {
      this.state.items = ['hello', 'world']
    },
  }

  const getterSpy = vi.fn()

  const App = defineComponent(async () => {
    const msg = computed(() => {
      getterSpy()
      return store.state.items?.join(' ')
    })

    // If msg value is falsy then we are either in ssr context or on the client
    // and the initial state was not modified/hydrated.
    // In both cases we need to fetch data.
    if (!msg.value) await store.fetchData()

    return () => h('div', null, msg.value + msg.value + msg.value)
  })

  const app = createSSRApp(App)

  const html = await renderToString(app)
  expect(html).toMatch('hello world')

  // should only be called twice since access should be cached
  // during the render phase
  expect(getterSpy).toHaveBeenCalledTimes(2)
})
