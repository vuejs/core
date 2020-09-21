import { ref } from '@vue/reactivity'
import { h, nextTick, staticComputed } from '@vue/runtime-core'
import { nodeOps, render } from '@vue/runtime-test'

it('detach staticComputed from components and stop them manually', async () => {
  const toggle = ref(true)

  class Service {
    counter = ref(0)
    counterComputed = staticComputed(() => this.counter.value + 1)
  }

  let singleton: Service

  function makeService() {
    if (!singleton) {
      singleton = new Service()
    }
    return singleton
  }

  const Child = {
    setup() {
      makeService()
    },
    render() {}
  }

  const App = {
    setup() {
      return () => {
        return toggle.value ? h(Child) : null
      }
    }
  }

  render(h(App), nodeOps.createElement('div'))

  expect(`must be stopped manually`).toHaveBeenWarned()

  await nextTick()
  expect(singleton!.counterComputed.value).toBe(1)

  singleton!.counter.value++
  await nextTick()
  expect(singleton!.counterComputed.value).toBe(2)

  toggle.value = false
  await nextTick()
  toggle.value = true
  await nextTick()

  singleton!.counter.value++
  await nextTick()
  expect(singleton!.counterComputed.value).toBe(3)

  singleton!.counterComputed.stop()
  singleton!.counter.value++
  await nextTick()
  expect(singleton!.counterComputed.value).toBe(3)
})
