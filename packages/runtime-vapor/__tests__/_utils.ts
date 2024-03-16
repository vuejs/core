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
  beforeEach(() => {
    host = initHost()
  })
  afterEach(() => {
    host.remove()
  })

  const define = (comp: Component) => {
    const component = defineComponent(comp as any)
    let instance: ComponentInternalInstance
    let app: App
    const render = (
      props: RawProps = {},
      container: string | ParentNode = '#host',
    ) => {
      app = createVaporApp(component, props)
      instance = app.mount(container)
      return res()
    }
    const res = () => ({
      component,
      host,
      instance,
      app,
      render,
    })

    return res()
  }

  return define
}
