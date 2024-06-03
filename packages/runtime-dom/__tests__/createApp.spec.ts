import { createApp, h } from '../src'
import { defineComponent, onMounted, shallowRef } from 'vue'

describe('createApp for dom', () => {
  // #2926
  test('mount to SVG container', () => {
    const root = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    createApp({
      render() {
        return h('g')
      },
    }).mount(root)
    expect(root.children.length).toBe(1)
    expect(root.children[0]).toBeInstanceOf(SVGElement)
  })

  // #4398
  test('should not mutate original root component options object', () => {
    const originalObj = {
      data() {
        return {
          counter: 0,
        }
      },
    }

    const handler = vi.fn(msg => {
      expect(msg).toMatch(`Component is missing template or render function`)
    })

    const Root = { ...originalObj }

    const app = createApp(Root)
    app.config.warnHandler = handler
    app.mount(document.createElement('div'))

    // ensure mount is based on a copy of Root object rather than Root object itself
    expect(app._component).not.toBe(Root)

    // ensure no mutation happened to Root object
    expect(originalObj).toMatchObject(Root)
  })
  test('When the app is unmounted, the onMounted of suspense in Transition should not be called', async () => {
    const onPage2Mounted = vi.fn()
    const Page1 = defineComponent({
      name: 'Page1',
      setup() {
        return () => h('div', null, 'page1')
      },
    })
    const Page2 = defineComponent({
      name: 'Page2',
      setup() {
        onMounted(onPage2Mounted)
        return () => h('div', null, 'page2')
      },
    })
    const Component = shallowRef(Page1)
    const App = defineComponent({
      setup() {
        return {
          Component,
        }
      },
      template: `
          <div>
            <template v-if="Component">
                <transition :duration="300" mode="out-in" appear>
                  <keep-alive :include="['Page1', 'Page2']">
                    <suspense>
                      <component :is="Component" :key="Component.name"></component>
                    </suspense>
                  </keep-alive>
                </transition>
              </template>
          </div>
        `,
    })
    const app = createApp(App)
    app.mount(document.createElement('div'))
    Component.value = Page2
    app.unmount()
    expect(onPage2Mounted).toHaveBeenCalledTimes(0)
  })
})
