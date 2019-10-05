const { createApp, computed } = Vue

const App = {
  template: `<div>{{message}}</div>`,
  setup() {
    const state = {
      hello: 'Hello',
      world: 'World',
      message: computed(() => `${state.hello} ${state.world}`)
    }
    return state
  }
}
createApp().mount(App, '#demo')
