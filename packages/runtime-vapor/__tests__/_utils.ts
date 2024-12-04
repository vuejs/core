import {
  type App,
  type Component,
  type ComponentInternalInstance,
  type ObjectComponent,
  type SetupFn,
  createVaporApp,
  defineComponent,
} from '../src'
import type { RawProps } from '../src/componentProps'

export interface RenderContext {
  component: Component
  host: HTMLElement
  instance: ComponentInternalInstance | undefined
  app: App
  create: (props?: RawProps) => RenderContext
  mount: (container?: string | ParentNode) => RenderContext
  render: (props?: RawProps, container?: string | ParentNode) => RenderContext
  resetHost: () => HTMLDivElement
  html: () => string
}

export function makeRender<C = ObjectComponent | SetupFn>(
  initHost = (): HTMLDivElement => {
    const host = document.createElement('div')
    host.setAttribute('id', 'host')
    document.body.appendChild(host)
    return host
  },
): (comp: C) => RenderContext {
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

  function define(comp: C) {
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

    function html() {
      return host.innerHTML
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
      html,
    })

    return res()
  }

  return define
}
