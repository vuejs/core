import { createVaporSSRApp, delegateEvents } from '../../src'
import type { App } from '@vue/runtime-dom'
import { ref } from '@vue/runtime-dom'
import { isString } from '@vue/shared'
import type { Block } from '../../src/block'
import type { VaporComponentInstance } from '../../src/component'
import { VueServerRenderer, compile, runtimeDom, runtimeVapor } from '../_utils'

/**
 * Registers the hooks every hydration spec file needs: delegated click events
 * and a clean `document.body` per test. Call once at the top of each spec file,
 * before its `describe` blocks, so the reset runs ahead of suite-local hooks
 * (`sequence.hooks` is `list`).
 */
export function setupHydrationTest(): void {
  delegateEvents('click')

  beforeEach(() => {
    document.body.innerHTML = ''
  })
}

export interface HydrationTestContext {
  data: any
  container: HTMLDivElement
  html: string
  app: App<any>
}

export interface MountWithHydrationContext {
  block: Block
  container: HTMLDivElement
}

export const formatHtml = (raw: string): string => {
  return raw
    .replace(/<!--\[/g, '\n<!--[')
    .replace(/]-->/g, ']-->\n')
    .replace(/<!--teleport (start|end)-->/g, '\n<!--teleport $1-->\n')
    .replace(/\n{2,}/g, '\n')
}

export const formatNodeList = (nodes: ArrayLike<Node>): string[] => {
  return Array.from(nodes).map(node => {
    if (node.nodeType === 8) {
      return `<!--${(node as Comment).data}-->`
    }
    if (node.nodeType === 3) {
      return `text(${JSON.stringify((node as Text).data)})`
    }
    return (node as Element).outerHTML
  })
}

export async function testWithVaporApp(
  code: string,
  components?: Record<string, string | { code: string; vapor: boolean }>,
  data?: any,
): Promise<HydrationTestContext> {
  return testHydration(code, components, data, {
    isVaporApp: true,
    interop: true,
  })
}

export async function testWithVDOMApp(
  code: string,
  components?: Record<string, string | { code: string; vapor: boolean }>,
  data?: any,
): Promise<HydrationTestContext> {
  return testHydration(code, components, data, {
    isVaporApp: false,
    interop: true,
  })
}

export function compileVaporComponent(
  code: string,
  data: runtimeDom.Ref<any> = ref({}),
  components?: Record<string, any>,
  ssr = false,
): any {
  if (!code.includes(`<script`)) {
    code = `<template>${code}</template>`
  }
  return compile(code, data, components, {
    vapor: true,
    ssr,
  })
}

export async function mountWithHydration(
  html: string,
  code: string,
  data: runtimeDom.Ref<any> = ref({}),
  components?: Record<string, any>,
): Promise<MountWithHydrationContext> {
  const container = document.createElement('div')
  container.innerHTML = html
  document.body.appendChild(container)

  const clientComp = compileVaporComponent(code, data, components)
  const app = createVaporSSRApp(clientComp)
  app.mount(container)

  return {
    block: (app._instance! as VaporComponentInstance).block,
    container,
  }
}

export async function testHydration(
  code: string,
  components: Record<string, string | { code: string; vapor: boolean }> = {},
  data: any = ref('foo'),
  {
    isVaporApp = true,
    interop = false,
  }: { isVaporApp?: boolean; interop?: boolean } = {},
): Promise<HydrationTestContext> {
  const ssrComponents: any = {}
  const clientComponents: any = {}
  for (const key in components) {
    const comp = components[key]
    const code = isString(comp) ? comp : comp.code
    const isVaporComp = isString(comp) || !!comp.vapor
    clientComponents[key] = compile(code, data, clientComponents, {
      vapor: isVaporComp,
      ssr: false,
    })
    ssrComponents[key] = compile(code, data, ssrComponents, {
      vapor: isVaporComp,
      ssr: true,
    })
  }

  const serverComp = compile(code, data, ssrComponents, {
    vapor: isVaporApp,
    ssr: true,
  })
  const html = await VueServerRenderer.renderToString(
    runtimeDom.createSSRApp(serverComp),
  )
  const container = document.createElement('div')
  document.body.appendChild(container)
  container.innerHTML = html

  const clientComp = compile(code, data, clientComponents, {
    vapor: isVaporApp,
    ssr: false,
  })
  let app
  if (isVaporApp) {
    app = createVaporSSRApp(clientComp)
  } else {
    app = runtimeDom.createSSRApp(clientComp)
  }

  if (interop) {
    app.use(runtimeVapor.vaporInteropPlugin)
  }

  app.mount(container)
  return { data, container, html, app }
}

export const triggerEvent = (type: string, el: Element): void => {
  const event = new Event(type, { bubbles: true })
  el.dispatchEvent(event)
}
