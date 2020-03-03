import {
  ComponentInternalInstance,
  FunctionalComponent,
  Data
} from './component'
import {
  VNode,
  normalizeVNode,
  createVNode,
  Comment,
  cloneVNode
} from './vnode'
import { handleError, ErrorCodes } from './errorHandling'
import { PatchFlags, ShapeFlags, EMPTY_OBJ, isOn } from '@vue/shared'
import { warn } from './warning'

// mark the current rendering instance for asset resolution (e.g.
// resolveComponent, resolveDirective) during render
export let currentRenderingInstance: ComponentInternalInstance | null = null

// exposed for server-renderer only
export function setCurrentRenderingInstance(
  instance: ComponentInternalInstance | null
) {
  currentRenderingInstance = instance
}

// dev only flag to track whether $attrs was used during render.
// If $attrs was used during render then the warning for failed attrs
// fallthrough can be suppressed.
let accessedAttrs: boolean = false

export function markAttrsAccessed() {
  accessedAttrs = true
}

export function renderComponentRoot(
  instance: ComponentInternalInstance
): VNode {
  const {
    type: Component,
    parent,
    vnode,
    proxy,
    withProxy,
    props,
    slots,
    attrs,
    vnodeHooks,
    emit,
    renderCache
  } = instance

  let result
  currentRenderingInstance = instance
  if (__DEV__) {
    accessedAttrs = false
  }
  try {
    if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
      // withProxy is a proxy with a diffrent `has` trap only for
      // runtime-compiled render functions using `with` block.
      const proxyToUse = withProxy || proxy
      result = normalizeVNode(
        instance.render!.call(proxyToUse, proxyToUse, renderCache)
      )
    } else {
      // functional
      const render = Component as FunctionalComponent
      result = normalizeVNode(
        render.length > 1
          ? render(props, {
              attrs,
              slots,
              emit
            })
          : render(props, null as any /* we know it doesn't need it */)
      )
    }

    // attr merging
    let fallthroughAttrs
    if (
      Component.inheritAttrs !== false &&
      attrs !== EMPTY_OBJ &&
      (fallthroughAttrs = getFallthroughAttrs(attrs))
    ) {
      if (
        result.shapeFlag & ShapeFlags.ELEMENT ||
        result.shapeFlag & ShapeFlags.COMPONENT
      ) {
        result = cloneVNode(result, fallthroughAttrs)
        // If the child root node is a compiler optimized vnode, make sure it
        // force update full props to account for the merged attrs.
        if (result.dynamicChildren !== null) {
          result.patchFlag |= PatchFlags.FULL_PROPS
        }
      } else if (__DEV__ && !accessedAttrs && result.type !== Comment) {
        warn(
          `Extraneous non-props attributes (` +
            `${Object.keys(attrs).join(', ')}) ` +
            `were passed to component but could not be automatically inherited ` +
            `because component renders fragment or text root nodes.`
        )
      }
    }

    // inherit vnode hooks
    if (vnodeHooks !== EMPTY_OBJ) {
      result = cloneVNode(result, vnodeHooks)
    }
    // inherit scopeId
    const parentScopeId = parent && parent.type.__scopeId
    if (parentScopeId) {
      result = cloneVNode(result, { [parentScopeId]: '' })
    }
    // inherit directives
    if (vnode.dirs != null) {
      if (__DEV__ && !isElementRoot(result)) {
        warn(
          `Runtime directive used on component with non-element root node. ` +
            `The directives will not function as intended.`
        )
      }
      result.dirs = vnode.dirs
    }
    // inherit transition data
    if (vnode.transition != null) {
      if (__DEV__ && !isElementRoot(result)) {
        warn(
          `Component inside <Transition> renders non-element root node ` +
            `that cannot be animated.`
        )
      }
      result.transition = vnode.transition
    }
  } catch (err) {
    handleError(err, instance, ErrorCodes.RENDER_FUNCTION)
    result = createVNode(Comment)
  }
  currentRenderingInstance = null

  return result
}

const getFallthroughAttrs = (attrs: Data): Data | undefined => {
  let res: Data | undefined
  for (const key in attrs) {
    if (
      key === 'class' ||
      key === 'style' ||
      key === 'role' ||
      isOn(key) ||
      key.indexOf('aria-') === 0 ||
      key.indexOf('data-') === 0
    ) {
      ;(res || (res = {}))[key] = attrs[key]
    }
  }
  return res
}

const isElementRoot = (vnode: VNode) => {
  return (
    vnode.shapeFlag & ShapeFlags.COMPONENT ||
    vnode.shapeFlag & ShapeFlags.ELEMENT ||
    vnode.type === Comment // potential v-if branch switch
  )
}

export function shouldUpdateComponent(
  prevVNode: VNode,
  nextVNode: VNode,
  parentComponent: ComponentInternalInstance | null,
  optimized?: boolean
): boolean {
  const { props: prevProps, children: prevChildren } = prevVNode
  const { props: nextProps, children: nextChildren, patchFlag } = nextVNode

  // Parent component's render function was hot-updated. Since this may have
  // caused the child component's slots content to have changed, we need to
  // force the child to update as well.
  if (
    __BUNDLER__ &&
    __DEV__ &&
    (prevChildren || nextChildren) &&
    parentComponent &&
    parentComponent.renderUpdated
  ) {
    return true
  }

  // force child update on runtime directive usage on component vnode.
  if (nextVNode.dirs != null) {
    return true
  }

  if (patchFlag > 0) {
    if (patchFlag & PatchFlags.DYNAMIC_SLOTS) {
      // slot content that references values that might have changed,
      // e.g. in a v-for
      return true
    }
    if (patchFlag & PatchFlags.FULL_PROPS) {
      // presence of this flag indicates props are always non-null
      return hasPropsChanged(prevProps!, nextProps!)
    } else {
      if (patchFlag & PatchFlags.CLASS) {
        return prevProps!.class !== nextProps!.class
      }
      if (patchFlag & PatchFlags.STYLE) {
        return hasPropsChanged(prevProps!.style, nextProps!.style)
      }
      if (patchFlag & PatchFlags.PROPS) {
        const dynamicProps = nextVNode.dynamicProps!
        for (let i = 0; i < dynamicProps.length; i++) {
          const key = dynamicProps[i]
          if (nextProps![key] !== prevProps![key]) {
            return true
          }
        }
      }
    }
  } else if (!optimized) {
    // this path is only taken by manually written render functions
    // so presence of any children leads to a forced update
    if (prevChildren != null || nextChildren != null) {
      if (nextChildren == null || !(nextChildren as any).$stable) {
        return true
      }
    }
    if (prevProps === nextProps) {
      return false
    }
    if (prevProps === null) {
      return nextProps !== null
    }
    if (nextProps === null) {
      return true
    }
    return hasPropsChanged(prevProps, nextProps)
  }

  return false
}

function hasPropsChanged(prevProps: Data, nextProps: Data): boolean {
  const nextKeys = Object.keys(nextProps)
  if (nextKeys.length !== Object.keys(prevProps).length) {
    return true
  }
  for (let i = 0; i < nextKeys.length; i++) {
    const key = nextKeys[i]
    if (nextProps[key] !== prevProps[key]) {
      return true
    }
  }
  return false
}

export function updateHOCHostEl(
  { vnode, parent }: ComponentInternalInstance,
  el: object // HostNode
) {
  while (parent && parent.subTree === vnode) {
    ;(vnode = parent.vnode).el = el
    parent = parent.parent
  }
}
