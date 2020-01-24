import {
  App,
  Component,
  ComponentInternalInstance,
  createComponentInstance,
  setupComponent,
  VNode,
  createVNode
} from 'vue'
import { isString } from '@vue/shared'

type SSRBuffer = SSRBufferItem[]
type SSRBufferItem = string | Promise<SSRBuffer>
type ResolvedSSRBuffer = (string | ResolvedSSRBuffer)[]

function createSSRBuffer() {
  let appendable = false
  const buffer: SSRBuffer = []
  return {
    buffer,
    push(item: SSRBufferItem) {
      const isStringItem = isString(item)
      if (appendable && isStringItem) {
        buffer[buffer.length - 1] += item as string
      } else {
        buffer.push(item)
      }
      appendable = isStringItem
    }
  }
}

export async function renderToString(app: App): Promise<string> {
  const resolvedBuffer = (await renderComponent(
    app._component,
    app._props
  )) as ResolvedSSRBuffer
  return unrollBuffer(resolvedBuffer)
}

function unrollBuffer(buffer: ResolvedSSRBuffer): string {
  let ret = ''
  for (let i = 0; i < buffer.length; i++) {
    const item = buffer[i]
    if (isString(item)) {
      ret += item
    } else {
      ret += unrollBuffer(item)
    }
  }
  return ret
}

export async function renderComponent(
  comp: Component,
  props: Record<string, any> | null = null,
  children: VNode['children'] = null,
  parentComponent: ComponentInternalInstance | null = null
): Promise<SSRBuffer> {
  // 1. create component buffer
  const { buffer, push } = createSSRBuffer()

  // 2. create actual instance
  const vnode = createVNode(comp, props, children)
  const instance = createComponentInstance(vnode, parentComponent)
  await setupComponent(instance, null)

  if (typeof comp === 'function') {
    // TODO FunctionalComponent
  } else {
    if (comp.ssrRender) {
      // optimized
      comp.ssrRender(push, instance.proxy)
    } else if (comp.render) {
      // TODO fallback to vdom serialization
    } else {
      // TODO warn component missing render function
    }
  }
  // TS can't figure this out due to recursive occurance of Promise in type
  // @ts-ignore
  return Promise.all(buffer)
}
