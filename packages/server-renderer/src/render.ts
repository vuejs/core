import {
  Comment,
  Component,
  ComponentInternalInstance,
  createVNode,
  DirectiveBinding,
  Fragment,
  mergeProps,
  Slot,
  Slots,
  ssrContextKey,
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

const {
  createComponentInstance,
  setCurrentRenderingInstance,
  setupComponent,
  renderComponentRoot,
  normalizeVNode,
  normalizeSuspenseChildren
} = ssrUtils

export type SSRBuffer = SSRBufferItem[]
export type SSRBufferItem =
  | string
  | SSRBuffer
  | ResolvedSSRBuffer
  | Promise<SSRBuffer>
  | Promise<ResolvedSSRBuffer>
export type ResolvedSSRBuffer = (string | ResolvedSSRBuffer)[]
export type PushFn = (item: SSRBufferItem) => void
export type Props = Record<string, unknown>

export type SSRContext = {
  [key: string]: any
  teleports?: Record<string, string>
  __teleportBuffers?: Record<string, SSRBuffer>
}

export type BufferInstance = {
  getBuffer: () => SSRBuffer | Promise<SSRBuffer>
  push: PushFn
}

export type SSRSlots = Record<string, SSRSlot>

export type SSRSlot = (
  props: Props,
  push: PushFn,
  parentComponent: ComponentInternalInstance | null,
  scopeId: string | null
) => void

export function createServerRenderer(createBuffer: () => BufferInstance) {
  function renderComponent(
    comp: Component,
    props: Props | null = null,
    children: Slots | SSRSlots | null = null,
    parentComponent: ComponentInternalInstance | null = null
  ): SSRBuffer | Promise<SSRBuffer> {
    return renderComponentVNode(
      createVNode(comp, props, children),
      parentComponent
    )
  }

  function renderComponentVNode(
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
          children
            ? `<!--${escapeHtmlComment(children as string)}-->`
            : `<!---->`
        )
        break
      case Static:
        push(children as string)
        break
      case Fragment:
        push(`<!--[-->`) // open
        renderVNodeChildren(
          push,
          children as VNodeArrayChildren,
          parentComponent
        )
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

  function renderVNodeChildren(
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

  function renderTeleport(
    parentPush: PushFn,
    contentRenderFn: (push: PushFn) => void,
    target: string,
    disabled: boolean,
    parentComponent: ComponentInternalInstance
  ) {
    parentPush('<!--teleport start-->')

    let teleportContent: SSRBufferItem

    if (disabled) {
      contentRenderFn(parentPush)
      teleportContent = `<!---->`
    } else {
      const { getBuffer, push } = createBuffer()
      contentRenderFn(push)
      push(`<!---->`) // teleport end anchor
      teleportContent = getBuffer()
    }

    const context = parentComponent.appContext.provides[
      ssrContextKey as any
    ] as SSRContext
    const teleportBuffers =
      context.__teleportBuffers || (context.__teleportBuffers = {})
    if (teleportBuffers[target]) {
      teleportBuffers[target].push(teleportContent)
    } else {
      teleportBuffers[target] = [teleportContent]
    }

    parentPush('<!--teleport end-->')
  }

  function renderSlot(
    slots: Slots | SSRSlots,
    slotName: string,
    slotProps: Props,
    fallbackRenderFn: (() => void) | null,
    push: PushFn,
    parentComponent: ComponentInternalInstance
  ) {
    // template-compiled slots are always rendered as fragments
    push(`<!--[-->`)
    const slotFn = slots[slotName]
    if (slotFn) {
      if (slotFn.length > 1) {
        // only ssr-optimized slot fns accept more than 1 arguments
        const scopeId = parentComponent && parentComponent.type.__scopeId
        slotFn(slotProps, push, parentComponent, scopeId ? ` ${scopeId}-s` : ``)
      } else {
        // normal slot
        renderVNodeChildren(push, (slotFn as Slot)(slotProps), parentComponent)
      }
    } else if (fallbackRenderFn) {
      fallbackRenderFn()
    }
    push(`<!--]-->`)
  }

  return {
    renderComponent,
    renderComponentVNode,
    renderSlot,
    renderTeleport
  }
}
