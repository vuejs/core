import {
  type App,
  type ComponentInternalInstance,
  type ObjectComponent,
  type SetupFn,
  createVaporApp,
  defineComponent,
} from '../src'
import type { RawProps } from '../src/componentProps'

export function makeRender<Component = ObjectComponent | SetupFn>(
  initHost = () => {
    const host = document.createElement('div')
    host.setAttribute('id', 'host')
    document.body.appendChild(host)
    return host
  },
) {
  let host: HTMLElement
  function resetHost() {
    return (host = initHost())
  }

  beforeEach(() => {
    resetHost()
  })
  afterEach(() => {
    host.remove()
  })

  function define(comp: Component) {
    const component = defineComponent(comp as any)
    let instance: ComponentInternalInstance | undefined
    let app: App

    function render(
      props: RawProps = {},
      container: string | ParentNode = host,
    ) {
      create(props)
      return mount(container)
    }

    function create(props: RawProps = {}) {
      app?.unmount()
      app = createVaporApp(component, props)
      return res()
    }

    function mount(container: string | ParentNode = host) {
      instance = app.mount(container)
      return res()
    }

    const res = () => ({
      component,
      host,
      instance,
      app,
      create,
      mount,
      render,
      resetHost,
    })

    return res()
  }

  return define
}
