import { createVaporApp, vaporInteropPlugin } from '../src'
import { type App, type Component, createApp } from '@vue/runtime-dom'
import type { VaporComponent, VaporComponentInstance } from '../src/component'
import type { RawProps } from '../src/componentProps'
import { compileScript, parse } from '@vue/compiler-sfc'
import * as runtimeVapor from '../src'
import * as runtimeDom from '@vue/runtime-dom'
import * as VueServerRenderer from '@vue/server-renderer'

export interface RenderContext {
  component: VaporComponent
  host: HTMLElement
  instance: VaporComponentInstance | undefined
  app: App
  create: (props?: RawProps) => RenderContext
  mount: (container?: string | ParentNode) => RenderContext
  render: (props?: RawProps, container?: string | ParentNode) => RenderContext
  resetHost: () => HTMLDivElement
  html: () => string
}

export function makeRender<C = VaporComponent>(
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
    const component = comp as any
    component.__vapor = true
    let instance: VaporComponentInstance | undefined
    let app: App

    function render(
      props: RawProps | undefined = undefined,
      container: string | ParentNode = host,
    ) {
      create(props)
      return mount(container)
    }

    function create(props: RawProps | undefined = undefined) {
      app?.unmount()
      app = createVaporApp(component, props)
      return res()
    }

    function mount(container: string | ParentNode = host) {
      app.mount(container)
      instance = app._instance as VaporComponentInstance
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

export interface InteropRenderContext {
  mount: (container?: string | ParentNode) => InteropRenderContext
  render: (
    props?: RawProps,
    container?: string | ParentNode,
  ) => InteropRenderContext
  host: HTMLElement
  html: () => string
}

export function makeInteropRender(): (comp: Component) => InteropRenderContext {
  let host: HTMLElement
  beforeEach(() => {
    host = document.createElement('div')
  })
  afterEach(() => {
    host.remove()
  })

  function define(comp: Component) {
    let app: App
    function render(
      props: RawProps | undefined = undefined,
      container: string | ParentNode = host,
    ) {
      app?.unmount()
      app = createApp(comp, props)
      app.use(vaporInteropPlugin)
      return mount(container)
    }

    function mount(container: string | ParentNode = host) {
      app.mount(container)
      return res()
    }

    function html() {
      return host.innerHTML
    }

    const res = () => ({
      host,
      mount,
      render,
      html,
    })

    return res()
  }

  return define
}

export { runtimeDom, runtimeVapor, VueServerRenderer }
export function compile(
  sfc: string,
  data: runtimeDom.Ref<any>,
  components: Record<string, any> = {},
  {
    vapor = true,
    ssr = false,
  }: {
    vapor?: boolean | undefined
    ssr?: boolean | undefined
  } = {},
): any {
  if (!sfc.includes(`<script`)) {
    sfc =
      `<script vapor>const data = _data; const components = _components;</script>` +
      sfc
  }
  const descriptor = parse(sfc).descriptor

  const script = compileScript(descriptor, {
    id: 'x',
    isProd: true,
    inlineTemplate: true,
    genDefaultAs: '__sfc__',
    vapor,
    templateOptions: {
      ssr,
    },
  })

  const code =
    script.content
      .replace(/\bimport {/g, 'const {')
      .replace(/ as _/g, ': _')
      .replace(/} from ['"]vue['"]/g, `} = Vue`)
      .replace(/} from "vue\/server-renderer"/g, '} = VueServerRenderer') +
    '\nreturn __sfc__'

  return new Function('Vue', 'VueServerRenderer', '_data', '_components', code)(
    { ...runtimeDom, ...runtimeVapor },
    VueServerRenderer,
    data,
    components,
  )
}
