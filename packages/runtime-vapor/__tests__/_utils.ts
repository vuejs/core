import { createVaporApp, vaporInteropPlugin } from '../src'
import { type App, type Component, createApp } from '@vue/runtime-dom'
import type { VaporComponent, VaporComponentInstance } from '../src/component'
import type { RawProps } from '../src/componentProps'

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

export function shuffle(array: Array<any>): any[] {
  let currentIndex = array.length
  let temporaryValue
  let randomIndex

  // while there remain elements to shuffle...
  while (currentIndex !== 0) {
    // pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex -= 1
    // and swap it with the current element.
    temporaryValue = array[currentIndex]
    array[currentIndex] = array[randomIndex]
    array[randomIndex] = temporaryValue
  }
  return array
}
