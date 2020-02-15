import {
  App,
  Component,
  ComponentInternalInstance,
  VNode,
  VNodeArrayChildren,
  createVNode,
  Text,
  Comment,
  Fragment,
  Portal,
  ssrUtils,
  Slots,
  warn
} from 'vue'
import {
  ShapeFlags,
  isString,
  isPromise,
  isArray,
  isFunction,
  isVoidTag,
  escapeHtml,
  NO,
  generateCodeFrame
} from '@vue/shared'
import { compile } from '@vue/compiler-ssr'
import { ssrRenderAttrs } from './helpers/ssrRenderAttrs'
import { SSRSlots } from './helpers/ssrRenderSlot'
import { CompilerError } from '@vue/compiler-dom'

const {
  isVNode,
  createComponentInstance,
  setCurrentRenderingInstance,
  setupComponent,
  renderComponentRoot,
  normalizeVNode
} = ssrUtils

// Each component has a buffer array.
// A buffer array can contain one of the following:
// - plain string
// - A resolved buffer (recursive arrays of strings that can be unrolled
//   synchronously)
// - An async buffer (a Promise that resolves to a resolved buffer)
type SSRBuffer = SSRBufferItem[]
type SSRBufferItem = string | ResolvedSSRBuffer | Promise<ResolvedSSRBuffer>
type ResolvedSSRBuffer = (string | ResolvedSSRBuffer)[]
export type PushFn = (item: SSRBufferItem) => void
export type Props = Record<string, unknown>

function createBuffer() {
  let appendable = false
  let hasAsync = false
  const buffer: SSRBuffer = []
  return {
    buffer,
    hasAsync() {
      return hasAsync
    },
    push(item: SSRBufferItem) {
      const isStringItem = isString(item)
      if (appendable && isStringItem) {
        buffer[buffer.length - 1] += item as string
      } else {
        buffer.push(item)
      }
      appendable = isStringItem
      if (!isStringItem && !isArray(item)) {
        // promise
        hasAsync = true
      }
    }
  }
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

export interface SSRContext {
  portals: Record<string, string>
}

export async function renderToString(
  input: App | VNode,
  ctx: SSRContext = { portals: {} }
): Promise<string> {
  let buffer: ResolvedSSRBuffer
  if (isVNode(input)) {
    // raw vnode, wrap with component
    buffer = await renderComponent(
      { render: () => input },
      null,
      null,
      null,
      ctx
    )
  } else {
    // rendering an app
    const vnode = createVNode(input._component, input._props)
    vnode.appContext = input._context
    buffer = await renderComponentVNode(vnode, null, ctx)
  }
  return unrollBuffer(buffer)
}

export function renderComponent(
  comp: Component,
  props: Props | null = null,
  children: Slots | SSRSlots | null = null,
  parentComponent: ComponentInternalInstance | null = null,
  ctx: SSRContext = { portals: {} }
): ResolvedSSRBuffer | Promise<ResolvedSSRBuffer> {
  return renderComponentVNode(
    createVNode(comp, props, children),
    parentComponent,
    ctx
  )
}

function renderComponentVNode(
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null = null,
  ctx: SSRContext = { portals: {} }
): ResolvedSSRBuffer | Promise<ResolvedSSRBuffer> {
  const instance = createComponentInstance(vnode, parentComponent)
  const res = setupComponent(
    instance,
    null /* parentSuspense (no need to track for SSR) */,
    true /* isSSR */
  )
  if (isPromise(res)) {
    return res.then(() => renderComponentSubTree(instance, ctx))
  } else {
    return renderComponentSubTree(instance, ctx)
  }
}

type SSRRenderFunction = (
  ctx: any,
  push: (item: any) => void,
  parentInstance: ComponentInternalInstance
) => void
const compileCache: Record<string, SSRRenderFunction> = Object.create(null)

function ssrCompile(
  template: string,
  instance: ComponentInternalInstance
): SSRRenderFunction {
  const cached = compileCache[template]
  if (cached) {
    return cached
  }

  const { code } = compile(template, {
    isCustomElement: instance.appContext.config.isCustomElement || NO,
    isNativeTag: instance.appContext.config.isNativeTag || NO,
    onError(err: CompilerError) {
      if (__DEV__) {
        const message = `Template compilation error: ${err.message}`
        const codeFrame =
          err.loc &&
          generateCodeFrame(
            template as string,
            err.loc.start.offset,
            err.loc.end.offset
          )
        warn(codeFrame ? `${message}\n${codeFrame}` : message)
      } else {
        throw err
      }
    }
  })
  return (compileCache[template] = Function(code)())
}

function renderComponentSubTree(
  instance: ComponentInternalInstance,
  ctx: SSRContext = { portals: {} }
): ResolvedSSRBuffer | Promise<ResolvedSSRBuffer> {
  const comp = instance.type as Component
  const { buffer, push, hasAsync } = createBuffer()
  if (isFunction(comp)) {
    renderVNode(push, renderComponentRoot(instance), instance, ctx)
  } else {
    if (!instance.render && !comp.ssrRender && isString(comp.template)) {
      comp.ssrRender = ssrCompile(comp.template, instance)
    }

    if (comp.ssrRender) {
      // optimized
      // set current rendering instance for asset resolution
      setCurrentRenderingInstance(instance)
      comp.ssrRender(instance.proxy, push, instance)
      setCurrentRenderingInstance(null)
    } else if (instance.render) {
      renderVNode(push, renderComponentRoot(instance), instance, ctx)
    } else {
      throw new Error(
        `Component ${
          comp.name ? `${comp.name} ` : ``
        } is missing template or render function.`
      )
    }
  }
  // If the current component's buffer contains any Promise from async children,
  // then it must return a Promise too. Otherwise this is a component that
  // contains only sync children so we can avoid the async book-keeping overhead.
  return hasAsync() ? Promise.all(buffer) : (buffer as ResolvedSSRBuffer)
}

function renderVNode(
  push: PushFn,
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null = null,
  ctx: SSRContext = { portals: {} }
) {
  const { type, shapeFlag, children } = vnode
  switch (type) {
    case Text:
      push(children as string)
      break
    case Comment:
      push(children ? `<!--${children}-->` : `<!---->`)
      break
    case Fragment:
      push(`<!---->`)
      renderVNodeChildren(
        push,
        children as VNodeArrayChildren,
        parentComponent,
        ctx
      )
      push(`<!---->`)
      break
    case Portal:
      if (!vnode.props || !vnode.props.target) {
        console.warn(`[@vue/server-renderer] Portal doesn't have target prop`)
        break
      }
      if (!isString(vnode.props.target)) {
        console.warn(
          `[@vue/server-renderer] Portal target must be a query selector`
        )
        break
      }

      push(
        (async () => {
          const { buffer: content, push: portalPush } = createBuffer()

          renderVNodeChildren(
            portalPush,
            children as VNodeArrayChildren,
            parentComponent,
            ctx
          )

          ctx.portals[vnode.props!.target] = unrollBuffer(
            await Promise.all(content)
          )

          return []
        })()
      )

      break
    default:
      if (shapeFlag & ShapeFlags.ELEMENT) {
        renderElement(push, vnode, parentComponent, ctx)
      } else if (shapeFlag & ShapeFlags.COMPONENT) {
        push(renderComponentVNode(vnode, parentComponent, ctx))
      } else if (shapeFlag & ShapeFlags.SUSPENSE) {
        // TODO
      } else {
        console.warn(
          '[@vue/server-renderer] Invalid VNode type:',
          type,
          `(${typeof type})`
        )
      }
  }
}

export function renderVNodeChildren(
  push: PushFn,
  children: VNodeArrayChildren,
  parentComponent: ComponentInternalInstance | null = null,
  ctx: SSRContext = { portals: {} }
) {
  for (let i = 0; i < children.length; i++) {
    renderVNode(push, normalizeVNode(children[i]), parentComponent, ctx)
  }
}

function renderElement(
  push: PushFn,
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null = null,
  ctx: SSRContext = { portals: {} }
) {
  const tag = vnode.type as string
  const { props, children, shapeFlag, scopeId } = vnode
  let openTag = `<${tag}`

  // TODO directives

  if (props !== null) {
    openTag += ssrRenderAttrs(props, tag)
  }

  if (scopeId !== null) {
    openTag += ` ${scopeId}`
    const treeOwnerId = parentComponent && parentComponent.type.__scopeId
    // vnode's own scopeId and the current rendering component's scopeId is
    // different - this is a slot content node.
    if (treeOwnerId != null && treeOwnerId !== scopeId) {
      openTag += ` ${treeOwnerId}-s`
    }
  }

  push(openTag + `>`)
  if (!isVoidTag(tag)) {
    let hasChildrenOverride = false
    if (props !== null) {
      if (props.innerHTML) {
        hasChildrenOverride = true
        push(props.innerHTML)
      } else if (props.textContent) {
        hasChildrenOverride = true
        push(escapeHtml(props.textContent))
      } else if (tag === 'textarea' && props.value) {
        hasChildrenOverride = true
        push(escapeHtml(props.value))
      }
    }
    if (!hasChildrenOverride) {
      if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
        push(escapeHtml(children as string))
      } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        renderVNodeChildren(
          push,
          children as VNodeArrayChildren,
          parentComponent,
          ctx
        )
      }
    }
    push(`</${tag}>`)
  }
}
