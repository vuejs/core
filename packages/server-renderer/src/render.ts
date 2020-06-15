import {
  Comment,
  Component,
  ComponentInternalInstance,
  DirectiveBinding,
  Fragment,
  mergeProps,
  ssrUtils,
  Static,
  Text,
  VNode,
  VNodeArrayChildren,
  VNodeProps,
  warn
} from '@vue/runtime-core'
import {
  escapeHtml,
  escapeHtmlComment,
  isFunction,
  isPromise,
  isString,
  isVoidTag,
  ShapeFlags
} from '@vue/shared'
import { ssrRenderAttrs } from './helpers/ssrRenderAttrs'
import { ssrCompile } from './helpers/ssrCompile'
import { renderTeleport } from './helpers/ssrRenderTeleport'

const {
  createComponentInstance,
  setCurrentRenderingInstance,
  setupComponent,
  renderComponentRoot,
  normalizeVNode,
  normalizeSuspenseChildren
} = ssrUtils

export type SSRBuffer = SSRBufferItem[]
export type SSRBufferItem = string | SSRBuffer | Promise<SSRBuffer>
export type PushFn = (item: SSRBufferItem) => void
export type Props = Record<string, unknown>

export type SSRContext = {
  [key: string]: any
  teleports?: Record<string, string>
  __teleportBuffers?: Record<string, SSRBuffer>
}

// Each component has a buffer array.
// A buffer array can contain one of the following:
// - plain string
// - A resolved buffer (recursive arrays of strings that can be unrolled
//   synchronously)
// - An async buffer (a Promise that resolves to a resolved buffer)
export function createBuffer() {
  let appendable = false
  const buffer: SSRBuffer = []
  return {
    getBuffer(): SSRBuffer {
      // Return static buffer and await on items during unroll stage
      return buffer
    },
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

export function renderComponentVNode(
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null = null
): SSRBuffer | Promise<SSRBuffer> {
  const instance = createComponentInstance(vnode, parentComponent, null)
  const res = setupComponent(instance, true /* isSSR */)
  if (isPromise(res)) {
    return res
      .catch(err => {
        warn(`[@vue/server-renderer]: Uncaught error in async setup:\n`, err)
      })
      .then(() => renderComponentSubTree(instance))
  } else {
    return renderComponentSubTree(instance)
  }
}

function renderComponentSubTree(
  instance: ComponentInternalInstance
): SSRBuffer | Promise<SSRBuffer> {
  const comp = instance.type as Component
  const { getBuffer, push } = createBuffer()
  if (isFunction(comp)) {
    renderVNode(push, renderComponentRoot(instance), instance)
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
      renderVNode(push, renderComponentRoot(instance), instance)
    } else {
      warn(
        `Component ${
          comp.name ? `${comp.name} ` : ``
        } is missing template or render function.`
      )
      push(`<!---->`)
    }
  }
  return getBuffer()
}

function renderVNode(
  push: PushFn,
  vnode: VNode,
  parentComponent: ComponentInternalInstance
) {
  const { type, shapeFlag, children } = vnode
  switch (type) {
    case Text:
      push(escapeHtml(children as string))
      break
    case Comment:
      push(
        children ? `<!--${escapeHtmlComment(children as string)}-->` : `<!---->`
      )
      break
    case Static:
      push(children as string)
      break
    case Fragment:
      push(`<!--[-->`) // open
      renderVNodeChildren(push, children as VNodeArrayChildren, parentComponent)
      push(`<!--]-->`) // close
      break
    default:
      if (shapeFlag & ShapeFlags.ELEMENT) {
        renderElementVNode(push, vnode, parentComponent)
      } else if (shapeFlag & ShapeFlags.COMPONENT) {
        push(renderComponentVNode(vnode, parentComponent))
      } else if (shapeFlag & ShapeFlags.TELEPORT) {
        renderTeleportVNode(push, vnode, parentComponent)
      } else if (shapeFlag & ShapeFlags.SUSPENSE) {
        renderVNode(
          push,
          normalizeSuspenseChildren(vnode).content,
          parentComponent
        )
      } else {
        warn(
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
  parentComponent: ComponentInternalInstance
) {
  for (let i = 0; i < children.length; i++) {
    renderVNode(push, normalizeVNode(children[i]), parentComponent)
  }
}

function renderElementVNode(
  push: PushFn,
  vnode: VNode,
  parentComponent: ComponentInternalInstance
) {
  const tag = vnode.type as string
  let { props, children, shapeFlag, scopeId, dirs } = vnode
  let openTag = `<${tag}`

  if (dirs) {
    props = applySSRDirectives(vnode, props, dirs)
  }

  if (props) {
    openTag += ssrRenderAttrs(props, tag)
  }

  if (scopeId) {
    openTag += ` ${scopeId}`
    const treeOwnerId = parentComponent && parentComponent.type.__scopeId
    // vnode's own scopeId and the current rendering component's scopeId is
    // different - this is a slot content node.
    if (treeOwnerId && treeOwnerId !== scopeId) {
      openTag += ` ${treeOwnerId}-s`
    }
  }

  push(openTag + `>`)
  if (!isVoidTag(tag)) {
    let hasChildrenOverride = false
    if (props) {
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
          parentComponent
        )
      }
    }
    push(`</${tag}>`)
  }
}

function applySSRDirectives(
  vnode: VNode,
  rawProps: VNodeProps | null,
  dirs: DirectiveBinding[]
): VNodeProps {
  const toMerge: VNodeProps[] = []
  for (let i = 0; i < dirs.length; i++) {
    const binding = dirs[i]
    const {
      dir: { getSSRProps }
    } = binding
    if (getSSRProps) {
      const props = getSSRProps(binding, vnode)
      if (props) toMerge.push(props)
    }
  }
  return mergeProps(rawProps || {}, ...toMerge)
}

function renderTeleportVNode(
  push: PushFn,
  vnode: VNode,
  parentComponent: ComponentInternalInstance
) {
  const target = vnode.props && vnode.props.to
  const disabled = vnode.props && vnode.props.disabled
  if (!target) {
    warn(`[@vue/server-renderer] Teleport is missing target prop.`)
    return []
  }
  if (!isString(target)) {
    warn(
      `[@vue/server-renderer] Teleport target must be a query selector string.`
    )
    return []
  }
  renderTeleport(
    push,
    push => {
      renderVNodeChildren(
        push,
        vnode.children as VNodeArrayChildren,
        parentComponent
      )
    },
    target,
    disabled || disabled === '',
    parentComponent
  )
}
