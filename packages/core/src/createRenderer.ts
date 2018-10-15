import { autorun, stop } from '@vue/observer'
import { queueJob } from '@vue/scheduler'
import { VNodeFlags, ChildrenFlags } from './flags'
import { EMPTY_OBJ, reservedPropRE, lis } from './utils'
import {
  VNode,
  MountedVNode,
  RenderNode,
  createTextVNode,
  cloneVNode,
  Ref,
  VNodeChildren
} from './vdom'
import {
  ComponentInstance,
  FunctionalComponent,
  ComponentClass
} from './component'
import { updateProps } from './componentProps'
import {
  renderInstanceRoot,
  renderFunctionalRoot,
  createComponentInstance,
  teardownComponentInstance,
  shouldUpdateFunctionalComponent
} from './componentUtils'
import { KeepAliveSymbol } from './optional/keepAlive'
import { pushContext, popContext } from './warning'

interface NodeOps {
  createElement: (tag: string, isSVG?: boolean) => any
  createText: (text: string) => any
  setText: (node: any, text: string) => void
  appendChild: (parent: any, child: any) => void
  insertBefore: (parent: any, child: any, ref: any) => void
  removeChild: (parent: any, child: any) => void
  clearContent: (node: any) => void
  parentNode: (node: any) => any
  nextSibling: (node: any) => any
  querySelector: (selector: string) => any
}

interface PatchDataFunction {
  (
    el: any,
    key: string,
    prevValue: any,
    nextValue: any,
    preVNode: VNode | null,
    nextVNode: VNode,
    isSVG: boolean,
    // passed for DOM operations that removes child content
    // e.g. innerHTML & textContent
    unmountChildren: (children: VNode[], childFlags: ChildrenFlags) => void
  ): void
}

interface RendererOptions {
  nodeOps: NodeOps
  patchData: PatchDataFunction
  teardownVNode?: (vnode: VNode) => void
}

// The whole mounting / patching / unmouting logic is placed inside this
// single function so that we can create multiple renderes with different
// platform definitions. This allows for use cases like creating a test
// renderer alongside an actual renderer.
export function createRenderer(options: RendererOptions) {
  const {
    nodeOps: {
      createElement: platformCreateElement,
      createText: platformCreateText,
      setText: platformSetText,
      appendChild: platformAppendChild,
      insertBefore: platformInsertBefore,
      removeChild: platformRemoveChild,
      clearContent: platformClearContent,
      parentNode: platformParentNode,
      nextSibling: platformNextSibling,
      querySelector: platformQuerySelector
    },
    patchData: platformPatchData,
    teardownVNode
  } = options

  function insertOrAppend(
    container: RenderNode,
    newNode: RenderNode,
    refNode: RenderNode | null
  ) {
    if (refNode === null) {
      platformAppendChild(container, newNode)
    } else {
      platformInsertBefore(container, newNode, refNode)
    }
  }

  // Lifecycle Hooks -----------------------------------------------------------

  const lifecycleHooks: Function[] = []
  const vnodeUpdatedHooks: Function[] = []

  function flushHooks() {
    let fn
    while ((fn = lifecycleHooks.shift())) {
      fn()
    }
  }

  // mounting ------------------------------------------------------------------

  function mount(
    vnode: VNode,
    container: RenderNode | null,
    contextVNode: MountedVNode | null,
    isSVG: boolean,
    endNode: RenderNode | null
  ) {
    const { flags } = vnode
    if (flags & VNodeFlags.ELEMENT) {
      mountElement(vnode, container, contextVNode, isSVG, endNode)
    } else if (flags & VNodeFlags.COMPONENT) {
      mountComponent(vnode, container, contextVNode, isSVG, endNode)
    } else if (flags & VNodeFlags.TEXT) {
      mountText(vnode, container, endNode)
    } else if (flags & VNodeFlags.FRAGMENT) {
      mountFragment(vnode, container, contextVNode, isSVG, endNode)
    } else if (flags & VNodeFlags.PORTAL) {
      mountPortal(vnode, container, contextVNode)
    }
  }

  function mountArrayChildren(
    children: VNode[],
    container: RenderNode | null,
    contextVNode: MountedVNode | null,
    isSVG: boolean,
    endNode: RenderNode | null
  ) {
    for (let i = 0; i < children.length; i++) {
      let child = children[i]
      if (child.el) {
        children[i] = child = cloneVNode(child)
      }
      mount(children[i], container, contextVNode, isSVG, endNode)
    }
  }

  function mountElement(
    vnode: VNode,
    container: RenderNode | null,
    contextVNode: MountedVNode | null,
    isSVG: boolean,
    endNode: RenderNode | null
  ) {
    const { flags, tag, data, children, childFlags, ref } = vnode
    isSVG = isSVG || (flags & VNodeFlags.ELEMENT_SVG) > 0
    const el = (vnode.el = platformCreateElement(tag as string, isSVG))
    if (data != null) {
      for (const key in data) {
        patchData(el, key, null, data[key], null, vnode, isSVG)
      }
      if (data.vnodeBeforeMount) {
        data.vnodeBeforeMount(vnode)
      }
    }
    if (childFlags !== ChildrenFlags.NO_CHILDREN) {
      const hasSVGChildren = isSVG && tag !== 'foreignObject'
      if (childFlags & ChildrenFlags.SINGLE_VNODE) {
        mount(children as VNode, el, contextVNode, hasSVGChildren, endNode)
      } else if (childFlags & ChildrenFlags.MULTIPLE_VNODES) {
        mountArrayChildren(
          children as VNode[],
          el,
          contextVNode,
          hasSVGChildren,
          endNode
        )
      }
    }
    if (container != null) {
      insertOrAppend(container, el, endNode)
    }
    if (ref) {
      mountRef(ref, el)
    }
    if (data != null && data.vnodeMounted) {
      lifecycleHooks.push(() => {
        data.vnodeMounted(vnode)
      })
    }
  }

  function mountRef(ref: Ref, el: RenderNode | ComponentInstance) {
    lifecycleHooks.push(() => {
      ref(el)
    })
  }

  function mountComponent(
    vnode: VNode,
    container: RenderNode | null,
    contextVNode: MountedVNode | null,
    isSVG: boolean,
    endNode: RenderNode | null
  ) {
    vnode.contextVNode = contextVNode
    if (__DEV__) {
      pushContext(vnode)
    }
    const { flags } = vnode
    if (flags & VNodeFlags.COMPONENT_STATEFUL) {
      mountStatefulComponent(vnode, container, isSVG, endNode)
    } else {
      mountFunctionalComponent(vnode, container, isSVG, endNode)
    }
    if (__DEV__) {
      popContext()
    }
  }

  function mountStatefulComponent(
    vnode: VNode,
    container: RenderNode | null,
    isSVG: boolean,
    endNode: RenderNode | null
  ) {
    if (vnode.flags & VNodeFlags.COMPONENT_STATEFUL_KEPT_ALIVE) {
      // kept-alive
      activateComponentInstance(vnode, container, endNode)
    } else {
      mountComponentInstance(
        vnode,
        vnode.tag as ComponentClass,
        container,
        isSVG,
        endNode
      )
    }
  }

  function mountFunctionalComponent(
    vnode: VNode,
    container: RenderNode | null,
    isSVG: boolean,
    endNode: RenderNode | null
  ) {
    const subTree = (vnode.children = renderFunctionalRoot(vnode))
    mount(subTree, container, vnode as MountedVNode, isSVG, endNode)
    vnode.el = subTree.el as RenderNode
  }

  function mountText(
    vnode: VNode,
    container: RenderNode | null,
    endNode: RenderNode | null
  ) {
    const el = (vnode.el = platformCreateText(vnode.children as string))
    if (container != null) {
      insertOrAppend(container, el, endNode)
    }
  }

  function mountFragment(
    vnode: VNode,
    container: RenderNode | null,
    contextVNode: MountedVNode | null,
    isSVG: boolean,
    endNode: RenderNode | null
  ) {
    const { children, childFlags } = vnode
    switch (childFlags) {
      case ChildrenFlags.SINGLE_VNODE:
        mount(children as VNode, container, contextVNode, isSVG, endNode)
        vnode.el = (children as MountedVNode).el
        break
      case ChildrenFlags.NO_CHILDREN:
        const placeholder = createTextVNode('')
        mountText(placeholder, container, null)
        vnode.el = placeholder.el
        break
      default:
        mountArrayChildren(
          children as VNode[],
          container,
          contextVNode,
          isSVG,
          endNode
        )
        vnode.el = (children as MountedVNode[])[0].el
    }
  }

  function mountPortal(
    vnode: VNode,
    container: RenderNode | null,
    contextVNode: MountedVNode | null
  ) {
    const { tag, children, childFlags, ref } = vnode
    const target = typeof tag === 'string' ? platformQuerySelector(tag) : tag

    if (__DEV__ && !target) {
      // TODO warn poartal target not found
    }

    if (childFlags & ChildrenFlags.SINGLE_VNODE) {
      mount(children as VNode, target as RenderNode, contextVNode, false, null)
    } else if (childFlags & ChildrenFlags.MULTIPLE_VNODES) {
      mountArrayChildren(
        children as VNode[],
        target as RenderNode,
        contextVNode,
        false,
        null
      )
    }
    if (ref) {
      mountRef(ref, target as RenderNode)
    }
    const placeholder = createTextVNode('')
    mountText(placeholder, container, null)
    vnode.el = placeholder.el
  }

  // patching ------------------------------------------------------------------

  function patchData(
    el: RenderNode,
    key: string,
    prevValue: any,
    nextValue: any,
    preVNode: VNode | null,
    nextVNode: VNode,
    isSVG: boolean
  ) {
    if (reservedPropRE.test(key)) {
      return
    }
    platformPatchData(
      el,
      key,
      prevValue,
      nextValue,
      preVNode,
      nextVNode,
      isSVG,
      unmountChildren
    )
  }

  function patch(
    prevVNode: MountedVNode,
    nextVNode: VNode,
    container: RenderNode,
    contextVNode: MountedVNode | null,
    isSVG: boolean
  ) {
    const nextFlags = nextVNode.flags
    const prevFlags = prevVNode.flags

    if (prevFlags !== nextFlags) {
      replaceVNode(prevVNode, nextVNode, container, contextVNode, isSVG)
    } else if (nextFlags & VNodeFlags.ELEMENT) {
      patchElement(prevVNode, nextVNode, container, contextVNode, isSVG)
    } else if (nextFlags & VNodeFlags.COMPONENT) {
      patchComponent(prevVNode, nextVNode, container, contextVNode, isSVG)
    } else if (nextFlags & VNodeFlags.TEXT) {
      patchText(prevVNode, nextVNode)
    } else if (nextFlags & VNodeFlags.FRAGMENT) {
      patchFragment(prevVNode, nextVNode, container, contextVNode, isSVG)
    } else if (nextFlags & VNodeFlags.PORTAL) {
      patchPortal(prevVNode, nextVNode, contextVNode)
    }
  }

  function patchElement(
    prevVNode: MountedVNode,
    nextVNode: VNode,
    container: RenderNode,
    contextVNode: MountedVNode | null,
    isSVG: boolean
  ) {
    const { flags, tag } = nextVNode
    isSVG = isSVG || (flags & VNodeFlags.ELEMENT_SVG) > 0

    if (prevVNode.tag !== tag) {
      replaceVNode(prevVNode, nextVNode, container, contextVNode, isSVG)
      return
    }

    const el = (nextVNode.el = prevVNode.el)
    const prevData = prevVNode.data
    const nextData = nextVNode.data

    if (nextData != null && nextData.vnodeBeforeUpdate) {
      nextData.vnodeBeforeUpdate(nextVNode, prevVNode)
    }

    // patch data
    if (prevData !== nextData) {
      const prevDataOrEmpty = prevData || EMPTY_OBJ
      const nextDataOrEmpty = nextData || EMPTY_OBJ
      if (nextDataOrEmpty !== EMPTY_OBJ) {
        for (const key in nextDataOrEmpty) {
          const prevValue = prevDataOrEmpty[key]
          const nextValue = nextDataOrEmpty[key]
          if (prevValue !== nextValue) {
            patchData(
              el,
              key,
              prevValue,
              nextValue,
              prevVNode,
              nextVNode,
              isSVG
            )
          }
        }
      }
      if (prevDataOrEmpty !== EMPTY_OBJ) {
        for (const key in prevDataOrEmpty) {
          const prevValue = prevDataOrEmpty[key]
          if (prevValue != null && !nextDataOrEmpty.hasOwnProperty(key)) {
            patchData(el, key, prevValue, null, prevVNode, nextVNode, isSVG)
          }
        }
      }
    }

    // children
    patchChildren(
      prevVNode.childFlags,
      nextVNode.childFlags,
      prevVNode.children,
      nextVNode.children,
      el,
      contextVNode,
      isSVG && nextVNode.tag !== 'foreignObject',
      null
    )

    if (nextData != null && nextData.vnodeUpdated) {
      vnodeUpdatedHooks.push(() => {
        nextData.vnodeUpdated(nextVNode, prevVNode)
      })
    }
  }

  function patchComponent(
    prevVNode: MountedVNode,
    nextVNode: VNode,
    container: RenderNode,
    contextVNode: MountedVNode | null,
    isSVG: boolean
  ) {
    if (__DEV__) {
      pushContext(nextVNode)
    }
    nextVNode.contextVNode = contextVNode
    const { tag, flags } = nextVNode
    if (tag !== prevVNode.tag) {
      replaceVNode(prevVNode, nextVNode, container, contextVNode, isSVG)
    } else if (flags & VNodeFlags.COMPONENT_STATEFUL) {
      patchStatefulComponent(prevVNode, nextVNode)
    } else {
      patchFunctionalComponent(
        prevVNode,
        nextVNode,
        container,
        contextVNode,
        isSVG
      )
    }
    if (__DEV__) {
      popContext()
    }
  }

  function patchStatefulComponent(prevVNode: MountedVNode, nextVNode: VNode) {
    const { childFlags: prevChildFlags } = prevVNode
    const {
      data: nextData,
      slots: nextSlots,
      childFlags: nextChildFlags
    } = nextVNode

    const instance = (nextVNode.children =
      prevVNode.children) as ComponentInstance
    instance.$slots = nextSlots || EMPTY_OBJ
    instance.$parentVNode = nextVNode as MountedVNode

    // Update props. This will trigger child update if necessary.
    if (nextData !== null) {
      updateProps(instance, nextData)
    }

    // If has different slots content, or has non-compiled slots,
    // the child needs to be force updated. It's ok to call $forceUpdate
    // again even if props update has already queued an update, as the
    // scheduler will not queue the same update twice.
    const shouldForceUpdate =
      prevChildFlags !== nextChildFlags ||
      (nextChildFlags & ChildrenFlags.DYNAMIC_SLOTS) > 0
    if (shouldForceUpdate) {
      instance.$forceUpdate()
    } else if (instance.$vnode.flags & VNodeFlags.COMPONENT) {
      instance.$vnode.contextVNode = nextVNode
    }
    nextVNode.el = instance.$vnode.el
  }

  function patchFunctionalComponent(
    prevVNode: MountedVNode,
    nextVNode: VNode,
    container: RenderNode,
    contextVNode: MountedVNode | null,
    isSVG: boolean
  ) {
    // functional component tree is stored on the vnode as `children`
    const { data: prevData, slots: prevSlots } = prevVNode
    const { data: nextData, slots: nextSlots } = nextVNode
    const render = nextVNode.tag as FunctionalComponent
    const prevTree = prevVNode.children as MountedVNode

    let shouldUpdate = true
    if (render.pure && prevSlots == null && nextSlots == null) {
      shouldUpdate = shouldUpdateFunctionalComponent(prevData, nextData)
    }

    if (shouldUpdate) {
      const nextTree = (nextVNode.children = renderFunctionalRoot(nextVNode))
      patch(prevTree, nextTree, container, nextVNode as MountedVNode, isSVG)
      nextVNode.el = nextTree.el
    } else if (prevTree.flags & VNodeFlags.COMPONENT) {
      // functional component returned another component
      prevTree.contextVNode = nextVNode
    }
  }

  function patchFragment(
    prevVNode: MountedVNode,
    nextVNode: VNode,
    container: RenderNode,
    contextVNode: MountedVNode | null,
    isSVG: boolean
  ) {
    // determine the tail node of the previous fragment,
    // then retrieve its next sibling to use as the end node for patchChildren.
    const endNode = platformNextSibling(getVNodeLastEl(prevVNode))
    const { childFlags, children } = nextVNode
    patchChildren(
      prevVNode.childFlags,
      childFlags,
      prevVNode.children,
      children,
      container,
      contextVNode,
      isSVG,
      endNode
    )
    switch (childFlags) {
      case ChildrenFlags.SINGLE_VNODE:
        nextVNode.el = (children as MountedVNode).el
        break
      case ChildrenFlags.NO_CHILDREN:
        nextVNode.el = prevVNode.el
        break
      default:
        nextVNode.el = (children as MountedVNode[])[0].el
    }
  }

  function getVNodeLastEl(vnode: MountedVNode): RenderNode {
    const { el, flags, children, childFlags } = vnode
    if (flags & VNodeFlags.FRAGMENT) {
      if (childFlags & ChildrenFlags.SINGLE_VNODE) {
        return getVNodeLastEl(children as MountedVNode)
      } else if (childFlags & ChildrenFlags.MULTIPLE_VNODES) {
        return getVNodeLastEl(
          (children as MountedVNode[])[(children as MountedVNode[]).length - 1]
        )
      } else {
        return el
      }
    } else {
      return el
    }
  }

  function patchText(prevVNode: MountedVNode, nextVNode: VNode) {
    const el = (nextVNode.el = prevVNode.el) as RenderNode
    const nextText = nextVNode.children
    if (nextText !== prevVNode.children) {
      platformSetText(el, nextText as string)
    }
  }

  function patchPortal(
    prevVNode: MountedVNode,
    nextVNode: VNode,
    contextVNode: MountedVNode | null
  ) {
    const prevContainer = prevVNode.tag as RenderNode
    const nextContainer = nextVNode.tag as RenderNode
    const nextChildren = nextVNode.children
    patchChildren(
      prevVNode.childFlags,
      nextVNode.childFlags,
      prevVNode.children,
      nextChildren,
      prevContainer,
      contextVNode,
      false,
      null
    )
    nextVNode.el = prevVNode.el
    if (nextContainer !== prevContainer) {
      switch (nextVNode.childFlags) {
        case ChildrenFlags.SINGLE_VNODE:
          insertVNode(nextChildren as MountedVNode, nextContainer, null)
          break
        case ChildrenFlags.NO_CHILDREN:
          break
        default:
          for (let i = 0; i < (nextChildren as MountedVNode[]).length; i++) {
            insertVNode(
              (nextChildren as MountedVNode[])[i],
              nextContainer,
              null
            )
          }
          break
      }
    }
  }

  function replaceVNode(
    prevVNode: MountedVNode,
    nextVNode: VNode,
    container: RenderNode,
    contextVNode: MountedVNode | null,
    isSVG: boolean
  ) {
    const refNode = platformNextSibling(getVNodeLastEl(prevVNode))
    removeVNode(prevVNode, container)
    mount(nextVNode, container, contextVNode, isSVG, refNode)
  }

  function patchChildren(
    prevChildFlags: ChildrenFlags,
    nextChildFlags: ChildrenFlags,
    prevChildren: VNodeChildren,
    nextChildren: VNodeChildren,
    container: RenderNode,
    contextVNode: MountedVNode | null,
    isSVG: boolean,
    endNode: RenderNode | null
  ) {
    switch (prevChildFlags) {
      case ChildrenFlags.SINGLE_VNODE:
        switch (nextChildFlags) {
          case ChildrenFlags.SINGLE_VNODE:
            patch(
              prevChildren as MountedVNode,
              nextChildren as VNode,
              container,
              contextVNode,
              isSVG
            )
            break
          case ChildrenFlags.NO_CHILDREN:
            removeVNode(prevChildren as MountedVNode, container)
            break
          default:
            removeVNode(prevChildren as MountedVNode, container)
            mountArrayChildren(
              nextChildren as VNode[],
              container,
              contextVNode,
              isSVG,
              endNode
            )
            break
        }
        break
      case ChildrenFlags.NO_CHILDREN:
        switch (nextChildFlags) {
          case ChildrenFlags.SINGLE_VNODE:
            mount(
              nextChildren as VNode,
              container,
              contextVNode,
              isSVG,
              endNode
            )
            break
          case ChildrenFlags.NO_CHILDREN:
            break
          default:
            mountArrayChildren(
              nextChildren as VNode[],
              container,
              contextVNode,
              isSVG,
              endNode
            )
            break
        }
        break
      default:
        // MULTIPLE_CHILDREN
        if (nextChildFlags === ChildrenFlags.SINGLE_VNODE) {
          removeChildren(prevChildren as MountedVNode[], container, endNode)
          mount(nextChildren as VNode, container, contextVNode, isSVG, endNode)
        } else if (nextChildFlags === ChildrenFlags.NO_CHILDREN) {
          removeChildren(prevChildren as MountedVNode[], container, endNode)
        } else {
          const prevLength = (prevChildren as VNode[]).length
          const nextLength = (nextChildren as VNode[]).length
          if (prevLength === 0) {
            if (nextLength > 0) {
              mountArrayChildren(
                nextChildren as VNode[],
                container,
                contextVNode,
                isSVG,
                endNode
              )
            }
          } else if (nextLength === 0) {
            removeChildren(prevChildren as MountedVNode[], container, endNode)
          } else if (
            prevChildFlags === ChildrenFlags.KEYED_VNODES &&
            nextChildFlags === ChildrenFlags.KEYED_VNODES
          ) {
            patchKeyedChildren(
              prevChildren as MountedVNode[],
              nextChildren as VNode[],
              container,
              prevLength,
              nextLength,
              contextVNode,
              isSVG,
              endNode
            )
          } else {
            patchNonKeyedChildren(
              prevChildren as MountedVNode[],
              nextChildren as VNode[],
              container,
              prevLength,
              nextLength,
              contextVNode,
              isSVG,
              endNode
            )
          }
        }
        break
    }
  }

  function patchNonKeyedChildren(
    prevChildren: MountedVNode[],
    nextChildren: VNode[],
    container: RenderNode,
    prevLength: number,
    nextLength: number,
    contextVNode: MountedVNode | null,
    isSVG: boolean,
    endNode: RenderNode | null
  ) {
    const commonLength = prevLength > nextLength ? nextLength : prevLength
    let i = 0
    let nextChild
    let prevChild
    for (i; i < commonLength; i++) {
      nextChild = nextChildren[i]
      prevChild = prevChildren[i]
      if (nextChild.el) {
        nextChildren[i] = nextChild = cloneVNode(nextChild)
      }
      patch(prevChild, nextChild, container, contextVNode, isSVG)
      prevChildren[i] = nextChild as MountedVNode
    }
    if (prevLength < nextLength) {
      for (i = commonLength; i < nextLength; i++) {
        nextChild = nextChildren[i]
        if (nextChild.el) {
          nextChildren[i] = nextChild = cloneVNode(nextChild)
        }
        mount(nextChild, container, contextVNode, isSVG, endNode)
      }
    } else if (prevLength > nextLength) {
      for (i = commonLength; i < prevLength; i++) {
        removeVNode(prevChildren[i], container)
      }
    }
  }

  function patchKeyedChildren(
    prevChildren: MountedVNode[],
    nextChildren: VNode[],
    container: RenderNode,
    prevLength: number,
    nextLength: number,
    contextVNode: MountedVNode | null,
    isSVG: boolean,
    endNode: RenderNode | null
  ) {
    let prevEnd = prevLength - 1
    let nextEnd = nextLength - 1
    let i
    let j = 0
    let prevVNode = prevChildren[j]
    let nextVNode = nextChildren[j]
    let nextPos

    outer: {
      // Sync nodes with the same key at the beginning.
      while (prevVNode.key === nextVNode.key) {
        if (nextVNode.el) {
          nextChildren[j] = nextVNode = cloneVNode(nextVNode)
        }
        patch(prevVNode, nextVNode, container, contextVNode, isSVG)
        prevChildren[j] = nextVNode as MountedVNode
        j++
        if (j > prevEnd || j > nextEnd) {
          break outer
        }
        prevVNode = prevChildren[j]
        nextVNode = nextChildren[j]
      }

      prevVNode = prevChildren[prevEnd]
      nextVNode = nextChildren[nextEnd]

      // Sync nodes with the same key at the end.
      while (prevVNode.key === nextVNode.key) {
        if (nextVNode.el) {
          nextChildren[nextEnd] = nextVNode = cloneVNode(nextVNode)
        }
        patch(prevVNode, nextVNode, container, contextVNode, isSVG)
        prevChildren[prevEnd] = nextVNode as MountedVNode
        prevEnd--
        nextEnd--
        if (j > prevEnd || j > nextEnd) {
          break outer
        }
        prevVNode = prevChildren[prevEnd]
        nextVNode = nextChildren[nextEnd]
      }
    }

    if (j > prevEnd) {
      if (j <= nextEnd) {
        nextPos = nextEnd + 1
        const nextNode =
          nextPos < nextLength ? nextChildren[nextPos].el : endNode
        while (j <= nextEnd) {
          nextVNode = nextChildren[j]
          if (nextVNode.el) {
            nextChildren[j] = nextVNode = cloneVNode(nextVNode)
          }
          j++
          mount(nextVNode, container, contextVNode, isSVG, nextNode)
        }
      }
    } else if (j > nextEnd) {
      while (j <= prevEnd) {
        removeVNode(prevChildren[j++], container)
      }
    } else {
      let prevStart = j
      const nextStart = j
      const prevLeft = prevEnd - j + 1
      const nextLeft = nextEnd - j + 1
      const sources: number[] = []
      for (i = 0; i < nextLeft; i++) {
        sources.push(0)
      }
      // Keep track if its possible to remove whole DOM using textContent = ''
      let canRemoveWholeContent = prevLeft === prevLength
      let moved = false
      let pos = 0
      let patched = 0

      // When sizes are small, just loop them through
      if (nextLength < 4 || (prevLeft | nextLeft) < 32) {
        for (i = prevStart; i <= prevEnd; i++) {
          prevVNode = prevChildren[i]
          if (patched < nextLeft) {
            for (j = nextStart; j <= nextEnd; j++) {
              nextVNode = nextChildren[j]
              if (prevVNode.key === nextVNode.key) {
                sources[j - nextStart] = i + 1
                if (canRemoveWholeContent) {
                  canRemoveWholeContent = false
                  while (i > prevStart) {
                    removeVNode(prevChildren[prevStart++], container)
                  }
                }
                if (pos > j) {
                  moved = true
                } else {
                  pos = j
                }
                if (nextVNode.el) {
                  nextChildren[j] = nextVNode = cloneVNode(nextVNode)
                }
                patch(prevVNode, nextVNode, container, contextVNode, isSVG)
                patched++
                break
              }
            }
            if (!canRemoveWholeContent && j > nextEnd) {
              removeVNode(prevVNode, container)
            }
          } else if (!canRemoveWholeContent) {
            removeVNode(prevVNode, container)
          }
        }
      } else {
        const keyIndex: Record<string, number> = {}

        // Map keys by their index
        for (i = nextStart; i <= nextEnd; i++) {
          keyIndex[nextChildren[i].key as string] = i
        }

        // Try to patch same keys
        for (i = prevStart; i <= prevEnd; i++) {
          prevVNode = prevChildren[i]

          if (patched < nextLeft) {
            j = keyIndex[prevVNode.key as string]

            if (j !== void 0) {
              if (canRemoveWholeContent) {
                canRemoveWholeContent = false
                while (i > prevStart) {
                  removeVNode(prevChildren[prevStart++], container)
                }
              }
              nextVNode = nextChildren[j]
              sources[j - nextStart] = i + 1
              if (pos > j) {
                moved = true
              } else {
                pos = j
              }
              if (nextVNode.el) {
                nextChildren[j] = nextVNode = cloneVNode(nextVNode)
              }
              patch(prevVNode, nextVNode, container, contextVNode, isSVG)
              patched++
            } else if (!canRemoveWholeContent) {
              removeVNode(prevVNode, container)
            }
          } else if (!canRemoveWholeContent) {
            removeVNode(prevVNode, container)
          }
        }
      }
      // fast-path: if nothing patched remove all old and add all new
      if (canRemoveWholeContent) {
        removeChildren(prevChildren as MountedVNode[], container, endNode)
        mountArrayChildren(
          nextChildren,
          container,
          contextVNode,
          isSVG,
          endNode
        )
      } else {
        if (moved) {
          const seq = lis(sources)
          j = seq.length - 1
          for (i = nextLeft - 1; i >= 0; i--) {
            if (sources[i] === 0) {
              pos = i + nextStart
              nextVNode = nextChildren[pos]
              if (nextVNode.el) {
                nextChildren[pos] = nextVNode = cloneVNode(nextVNode)
              }
              nextPos = pos + 1
              mount(
                nextVNode,
                container,
                contextVNode,
                isSVG,
                nextPos < nextLength ? nextChildren[nextPos].el : endNode
              )
            } else if (j < 0 || i !== seq[j]) {
              pos = i + nextStart
              nextVNode = nextChildren[pos]
              nextPos = pos + 1
              insertVNode(
                nextVNode as MountedVNode,
                container,
                nextPos < nextLength ? nextChildren[nextPos].el : endNode
              )
            } else {
              j--
            }
          }
        } else if (patched !== nextLeft) {
          // when patched count doesn't match b length we need to insert those
          // new ones loop backwards so we can use insertBefore
          for (i = nextLeft - 1; i >= 0; i--) {
            if (sources[i] === 0) {
              pos = i + nextStart
              nextVNode = nextChildren[pos]
              if (nextVNode.el) {
                nextChildren[pos] = nextVNode = cloneVNode(nextVNode)
              }
              nextPos = pos + 1
              mount(
                nextVNode,
                container,
                contextVNode,
                isSVG,
                nextPos < nextLength ? nextChildren[nextPos].el : endNode
              )
            }
          }
        }
      }
    }
  }

  function insertVNode(
    vnode: MountedVNode,
    container: RenderNode,
    refNode: RenderNode | null
  ) {
    const { flags, childFlags, children } = vnode
    if (flags & VNodeFlags.FRAGMENT) {
      switch (childFlags) {
        case ChildrenFlags.SINGLE_VNODE:
          insertVNode(children as MountedVNode, container, refNode)
          break
        case ChildrenFlags.NO_CHILDREN:
          break
        default:
          for (let i = 0; i < (children as MountedVNode[]).length; i++) {
            insertVNode((children as MountedVNode[])[i], container, refNode)
          }
      }
    } else {
      insertOrAppend(container, vnode.el as RenderNode, refNode)
    }
  }

  // unmounting ----------------------------------------------------------------

  function unmount(vnode: MountedVNode) {
    const { flags, data, children, childFlags, ref } = vnode
    const isElement = flags & VNodeFlags.ELEMENT
    if (isElement || flags & VNodeFlags.FRAGMENT) {
      if (isElement && data != null && data.vnodeBeforeUnmount) {
        data.vnodeBeforeUnmount(vnode)
      }
      unmountChildren(children as VNodeChildren, childFlags)
      if (teardownVNode !== void 0) {
        teardownVNode(vnode)
      }
      if (isElement && data != null && data.vnodeUnmounted) {
        data.vnodeUnmounted(vnode)
      }
    } else if (flags & VNodeFlags.COMPONENT) {
      if (flags & VNodeFlags.COMPONENT_STATEFUL) {
        if (flags & VNodeFlags.COMPONENT_STATEFUL_SHOULD_KEEP_ALIVE) {
          deactivateComponentInstance(children as ComponentInstance)
        } else {
          unmountComponentInstance(children as ComponentInstance)
        }
      } else {
        unmount(children as MountedVNode)
      }
    } else if (flags & VNodeFlags.PORTAL) {
      if (childFlags & ChildrenFlags.MULTIPLE_VNODES) {
        removeChildren(
          children as MountedVNode[],
          vnode.tag as RenderNode,
          null
        )
      } else if (childFlags === ChildrenFlags.SINGLE_VNODE) {
        removeVNode(children as MountedVNode, vnode.tag as RenderNode)
      }
    }
    if (ref) {
      ref(null)
    }
  }

  function unmountChildren(children: VNodeChildren, childFlags: ChildrenFlags) {
    if (childFlags & ChildrenFlags.MULTIPLE_VNODES) {
      unmountArrayChildren(children as MountedVNode[])
    } else if (childFlags === ChildrenFlags.SINGLE_VNODE) {
      unmount(children as MountedVNode)
    }
  }

  function unmountArrayChildren(children: MountedVNode[]) {
    for (let i = 0; i < children.length; i++) {
      unmount(children[i])
    }
  }

  function removeVNode(vnode: MountedVNode, container: RenderNode) {
    unmount(vnode)
    const { el, flags, children, childFlags } = vnode
    if (container && el) {
      if (flags & VNodeFlags.FRAGMENT) {
        switch (childFlags) {
          case ChildrenFlags.SINGLE_VNODE:
            removeVNode(children as MountedVNode, container)
            break
          case ChildrenFlags.NO_CHILDREN:
            platformRemoveChild(container, el)
            break
          default:
            for (let i = 0; i < (children as MountedVNode[]).length; i++) {
              removeVNode((children as MountedVNode[])[i], container)
            }
        }
      } else {
        platformRemoveChild(container, el)
      }
      ;(vnode as any).el = null
    }
  }

  function removeChildren(
    children: MountedVNode[],
    container: RenderNode,
    refNode: RenderNode | null
  ) {
    unmountArrayChildren(children)
    if (refNode === null) {
      platformClearContent(container)
    } else {
      for (let i = 0; i < children.length; i++) {
        removeVNode(children[i], container)
      }
    }
  }

  // Component lifecycle -------------------------------------------------------

  function mountComponentInstance(
    vnode: VNode,
    Component: ComponentClass,
    container: RenderNode | null,
    isSVG: boolean,
    endNode: RenderNode | null
  ): RenderNode {
    // a vnode may already have an instance if this is a compat call with
    // new Vue()
    const instance =
      (__COMPAT__ && (vnode.children as ComponentInstance)) ||
      createComponentInstance(vnode, Component)

    // inject platform-specific unmount to keep-alive container
    if ((Component as any)[KeepAliveSymbol] === true) {
      ;(instance as any).$unmount = unmountComponentInstance
    }

    if (instance.beforeMount) {
      instance.beforeMount.call(instance.$proxy)
    }

    const queueUpdate = (instance.$forceUpdate = () => {
      queueJob(instance._updateHandle, flushHooks)
    })

    instance._updateHandle = autorun(
      () => {
        if (instance._unmounted) {
          return
        }
        if (instance._mounted) {
          updateComponentInstance(instance, isSVG)
        } else {
          // this will be executed synchronously right here
          instance.$vnode = renderInstanceRoot(instance) as MountedVNode
          mount(
            instance.$vnode,
            container,
            vnode as MountedVNode,
            isSVG,
            endNode
          )
          vnode.el = instance.$vnode.el

          if (__COMPAT__) {
            // expose __vue__ for devtools
            ;(vnode.el as any).__vue__ = instance
          }

          instance._mounted = true
          mountComponentInstanceCallbacks(instance, vnode.ref)
        }
      },
      {
        scheduler: queueUpdate,
        onTrack: instance.renderTracked,
        onTrigger: instance.renderTriggered
      }
    )

    return vnode.el as RenderNode
  }

  function mountComponentInstanceCallbacks(
    instance: ComponentInstance,
    ref: Ref | null
  ) {
    if (ref) {
      mountRef(ref, instance.$proxy)
    }
    if (instance.mounted) {
      lifecycleHooks.push(() => {
        ;(instance as any).mounted.call(instance.$proxy)
      })
    }
  }

  function updateComponentInstance(
    instance: ComponentInstance,
    isSVG: boolean
  ) {
    if (__DEV__ && instance.$parentVNode) {
      pushContext(instance.$parentVNode as VNode)
    }
    const prevVNode = instance.$vnode

    if (instance.beforeUpdate) {
      instance.beforeUpdate.call(instance.$proxy, prevVNode)
    }

    const nextVNode = (instance.$vnode = renderInstanceRoot(
      instance
    ) as MountedVNode)
    const container = platformParentNode(prevVNode.el) as RenderNode
    patch(
      prevVNode,
      nextVNode,
      container,
      instance.$parentVNode as MountedVNode,
      isSVG
    )
    const el = nextVNode.el as RenderNode

    if (__COMPAT__) {
      // expose __vue__ for devtools
      ;(el as any).__vue__ = instance
    }

    // recursively update contextVNode el for nested HOCs
    if ((nextVNode.flags & VNodeFlags.PORTAL) === 0) {
      let vnode = instance.$parentVNode
      while (vnode !== null) {
        if ((vnode.flags & VNodeFlags.COMPONENT) > 0) {
          vnode.el = el
        }
        vnode = vnode.contextVNode
      }
    }

    if (instance.updated) {
      // Because the child's update is executed by the scheduler and not
      // synchronously within the parent's update call, the child's updated hook
      // will be added to the queue AFTER the parent's, but they should be
      // invoked BEFORE the parent's. Therefore we add them to the head of the
      // queue instead.
      lifecycleHooks.unshift(() => {
        ;(instance as any).updated.call(instance.$proxy, nextVNode)
      })
    }

    if (vnodeUpdatedHooks.length > 0) {
      const vnodeUpdatedHooksForCurrentInstance = vnodeUpdatedHooks.slice()
      vnodeUpdatedHooks.length = 0
      lifecycleHooks.unshift(() => {
        for (let i = 0; i < vnodeUpdatedHooksForCurrentInstance.length; i++) {
          vnodeUpdatedHooksForCurrentInstance[i]()
        }
      })
    }

    if (__DEV__ && instance.$parentVNode) {
      popContext()
    }
  }

  function unmountComponentInstance(instance: ComponentInstance) {
    if (instance._unmounted) {
      return
    }
    if (instance.beforeUnmount) {
      instance.beforeUnmount.call(instance.$proxy)
    }
    if (instance.$vnode) {
      unmount(instance.$vnode)
    }
    stop(instance._updateHandle)
    teardownComponentInstance(instance)
    instance._unmounted = true
    if (instance.unmounted) {
      instance.unmounted.call(instance.$proxy)
    }
  }

  // Keep Alive ----------------------------------------------------------------

  function activateComponentInstance(
    vnode: VNode,
    container: RenderNode | null,
    endNode: RenderNode | null
  ) {
    const instance = vnode.children as ComponentInstance
    vnode.el = instance.$el as RenderNode
    if (container != null) {
      insertVNode(instance.$vnode, container, endNode)
    }
    lifecycleHooks.push(() => {
      callActivatedHook(instance, true)
    })
  }

  function callActivatedHook(instance: ComponentInstance, asRoot: boolean) {
    // 1. check if we are inside an inactive parent tree.
    if (asRoot) {
      instance._inactiveRoot = false
      if (isInInactiveTree(instance)) return
    }
    if (asRoot || !instance._inactiveRoot) {
      // 2. recursively call activated on child tree, depth-first
      const { $children } = instance
      for (let i = 0; i < $children.length; i++) {
        callActivatedHook($children[i], false)
      }
      if (instance.activated) {
        instance.activated.call(instance.$proxy)
      }
    }
  }

  function deactivateComponentInstance(instance: ComponentInstance) {
    callDeactivateHook(instance, true)
  }

  function callDeactivateHook(instance: ComponentInstance, asRoot: boolean) {
    if (asRoot) {
      instance._inactiveRoot = true
      if (isInInactiveTree(instance)) return
    }
    if (asRoot || !instance._inactiveRoot) {
      // 2. recursively call deactivated on child tree, depth-first
      const { $children } = instance
      for (let i = 0; i < $children.length; i++) {
        callDeactivateHook($children[i], false)
      }
      if (instance.deactivated) {
        instance.deactivated.call(instance.$proxy)
      }
    }
  }

  function isInInactiveTree(instance: ComponentInstance): boolean {
    while ((instance = instance.$parent as any) !== null) {
      if (instance._inactiveRoot) return true
    }
    return false
  }

  // TODO hydrating ------------------------------------------------------------

  // API -----------------------------------------------------------------------

  function render(
    vnode: VNode | null,
    container: any
  ): ComponentInstance | null {
    const prevVNode = container.vnode
    if (vnode && vnode.el) {
      vnode = cloneVNode(vnode)
    }
    if (prevVNode == null) {
      if (vnode) {
        mount(vnode, container, null, false, null)
        container.vnode = vnode
      }
    } else {
      if (vnode) {
        patch(prevVNode, vnode, container, null, false)
        container.vnode = vnode
      } else {
        removeVNode(prevVNode, container)
        container.vnode = null
      }
    }
    flushHooks()
    return vnode && vnode.flags & VNodeFlags.COMPONENT_STATEFUL
      ? (vnode.children as ComponentInstance).$proxy
      : null
  }

  return { render }
}
