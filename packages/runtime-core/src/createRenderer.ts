import {
  autorun,
  stop,
  Autorun,
  immutable,
  AutorunOptions
} from '@vue/observer'
import {
  queueJob,
  handleSchedulerError,
  nextTick,
  queuePostCommitCb,
  flushPostCommitCbs,
  queueNodeOp
} from '@vue/scheduler'
import { VNodeFlags, ChildrenFlags } from './flags'
import { EMPTY_OBJ, reservedPropRE, isString } from '@vue/shared'
import {
  VNode,
  MountedVNode,
  RenderNode,
  createTextVNode,
  VNodeChildren
} from './vdom'
import { ComponentInstance } from './component'
import {
  renderInstanceRoot,
  renderFunctionalRoot,
  createComponentInstance,
  teardownComponentInstance,
  shouldUpdateComponent,
  getReasonForComponentUpdate
} from './componentUtils'
import { KeepAliveSymbol } from './optional/keepAlive'
import { pushWarningContext, popWarningContext, warn } from './warning'
import { resolveProps } from './componentProps'
import {
  handleError,
  ErrorTypes,
  callLifecycleHookWithHandler
} from './errorHandling'

export interface NodeOps {
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

export interface PatchDataFunction {
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

export interface RendererOptions {
  nodeOps: NodeOps
  patchData: PatchDataFunction
  teardownVNode?: (vnode: VNode) => void
}

export interface FunctionalHandle {
  current: VNode
  prevTree: VNode
  runner: Autorun
  forceUpdate: () => void
}

handleSchedulerError(err => handleError(err, null, ErrorTypes.SCHEDULER))

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
      queueNodeOp([platformAppendChild, container, newNode])
    } else {
      queueNodeOp([platformInsertBefore, container, newNode, refNode])
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
        mount(children as VNode, el, contextVNode, hasSVGChildren, null)
      } else if (childFlags & ChildrenFlags.MULTIPLE_VNODES) {
        mountArrayChildren(
          children as VNode[],
          el,
          contextVNode,
          hasSVGChildren,
          null
        )
      }
    }
    if (container != null) {
      insertOrAppend(container, el, endNode)
    }
    if (ref) {
      queuePostCommitCb(() => {
        ref(el)
      })
    }
    if (data != null && data.vnodeMounted) {
      queuePostCommitCb(() => {
        data.vnodeMounted(vnode)
      })
    }
  }

  function mountComponent(
    vnode: VNode,
    container: RenderNode | null,
    contextVNode: MountedVNode | null,
    isSVG: boolean,
    endNode: RenderNode | null
  ) {
    vnode.contextVNode = contextVNode
    const { flags } = vnode
    if (flags & VNodeFlags.COMPONENT_STATEFUL) {
      mountStatefulComponent(vnode, container, isSVG, endNode)
    } else {
      mountFunctionalComponent(vnode, container, isSVG, endNode)
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
      if (__COMPAT__) {
        mountComponentInstance(vnode, container, isSVG, endNode)
      } else {
        queueJob(() => mountComponentInstance(vnode, container, isSVG, endNode))
      }
    }
  }

  function mountFunctionalComponent(
    vnode: VNode,
    container: RenderNode | null,
    isSVG: boolean,
    endNode: RenderNode | null
  ) {
    if (__DEV__ && vnode.ref) {
      warn(
        `cannot use ref on a functional component because there is no ` +
          `instance to reference to.`
      )
    }

    const handle: FunctionalHandle = (vnode.handle = {
      current: vnode,
      prevTree: null as any,
      runner: null as any,
      forceUpdate: null as any
    })

    const queueUpdate = (handle.forceUpdate = () => {
      queueJob(handle.runner)
    })

    const doMount = () => {
      handle.runner = autorun(
        () => {
          if (!handle.prevTree) {
            // initial mount
            if (__DEV__) {
              pushWarningContext(vnode)
            }
            const subTree = (handle.prevTree = vnode.children = renderFunctionalRoot(
              vnode
            ))
            queuePostCommitCb(() => {
              vnode.el = subTree.el as RenderNode
            })
            mount(subTree, container, vnode as MountedVNode, isSVG, endNode)
            if (__DEV__) {
              popWarningContext()
            }
          } else {
            updateFunctionalComponent(handle, isSVG)
          }
        },
        {
          scheduler: queueUpdate
        }
      )
    }

    // we are using vnode.ref to store the functional component's update job
    if (__COMPAT__) {
      doMount()
    } else {
      queueJob(() => {
        doMount()
        // cleanup if mount is invalidated before committed
        return () => {
          stop(handle.runner)
        }
      })
    }
  }

  function updateFunctionalComponent(handle: FunctionalHandle, isSVG: boolean) {
    // mounted
    const { prevTree, current } = handle
    if (__DEV__) {
      pushWarningContext(current)
    }
    const nextTree = (handle.prevTree = current.children = renderFunctionalRoot(
      current
    ))
    queuePostCommitCb(() => {
      current.el = nextTree.el
    })
    patch(
      prevTree as MountedVNode,
      nextTree,
      platformParentNode(current.el),
      current as MountedVNode,
      isSVG
    )
    if (__DEV__) {
      popWarningContext()
    }
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
        queuePostCommitCb(() => {
          vnode.el = (children as MountedVNode).el
        })
        mount(children as VNode, container, contextVNode, isSVG, endNode)
        break
      case ChildrenFlags.NO_CHILDREN:
        const placeholder = createTextVNode('')
        mountText(placeholder, container, null)
        vnode.el = placeholder.el
        break
      default:
        queuePostCommitCb(() => {
          vnode.el = (children as MountedVNode[])[0].el
        })
        mountArrayChildren(
          children as VNode[],
          container,
          contextVNode,
          isSVG,
          endNode
        )
    }
  }

  function mountPortal(
    vnode: VNode,
    container: RenderNode | null,
    contextVNode: MountedVNode | null
  ) {
    const { tag, children, childFlags, ref } = vnode
    const target = isString(tag) ? platformQuerySelector(tag) : tag

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
      queuePostCommitCb(() => {
        ref(target)
      })
    }
    const placeholder = createTextVNode('')
    mountText(placeholder, container, null)
    vnode.el = placeholder.el
  }

  // patching ------------------------------------------------------------------

  function patchData(
    el: RenderNode | (() => RenderNode),
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
      typeof el === 'function' ? el() : el,
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
    if (prevVNode === nextVNode) {
      nextVNode.el = prevVNode.el
      return
    }

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
      // TODO fix me
      // vnodeUpdatedHooks.push(() => {
      //   nextData.vnodeUpdated(nextVNode, prevVNode)
      // })
    }
  }

  function patchComponent(
    prevVNode: MountedVNode,
    nextVNode: VNode,
    container: RenderNode,
    contextVNode: MountedVNode | null,
    isSVG: boolean
  ) {
    nextVNode.contextVNode = contextVNode
    const { tag, flags } = nextVNode
    if (tag !== prevVNode.tag) {
      replaceVNode(prevVNode, nextVNode, container, contextVNode, isSVG)
    } else if (flags & VNodeFlags.COMPONENT_STATEFUL) {
      patchStatefulComponent(prevVNode, nextVNode)
    } else {
      patchFunctionalComponent(prevVNode, nextVNode)
    }
  }

  function patchStatefulComponent(prevVNode: MountedVNode, nextVNode: VNode) {
    const { data: prevData } = prevVNode
    const { data: nextData, slots: nextSlots } = nextVNode

    const instance = (nextVNode.children =
      prevVNode.children) as ComponentInstance

    if (nextData !== prevData) {
      const { 0: props, 1: attrs } = resolveProps(
        nextData,
        instance.$options.props
      )
      instance.$props = __DEV__ ? immutable(props) : props
      instance.$attrs = __DEV__ ? immutable(attrs) : attrs
    }
    instance.$slots = nextSlots || EMPTY_OBJ
    instance.$parentVNode = nextVNode as MountedVNode

    if (shouldUpdateComponent(prevVNode, nextVNode)) {
      if (__DEV__ && instance.$options.renderTriggered) {
        callLifecycleHookWithHandler(
          instance.$options.renderTriggered,
          instance.$proxy,
          ErrorTypes.RENDER_TRIGGERED,
          getReasonForComponentUpdate(prevVNode, nextVNode)
        )
      }
      instance.$forceUpdate()
    } else if (instance.$vnode.flags & VNodeFlags.COMPONENT) {
      instance.$vnode.contextVNode = nextVNode
    }
    nextVNode.el = instance.$vnode.el
  }

  function patchFunctionalComponent(prevVNode: MountedVNode, nextVNode: VNode) {
    const prevTree = prevVNode.children as VNode
    const handle = (nextVNode.handle = prevVNode.handle as FunctionalHandle)
    handle.current = nextVNode

    if (shouldUpdateComponent(prevVNode, nextVNode)) {
      handle.forceUpdate()
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
    queuePostCommitCb(() => {
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
    })
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
      queueNodeOp([platformSetText, el, nextText])
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
    queueRemoveVNode(prevVNode, container)
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
            queueRemoveVNode(prevChildren as MountedVNode, container)
            break
          default:
            queueRemoveVNode(prevChildren as MountedVNode, container)
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
          queueRemoveChildren(
            prevChildren as MountedVNode[],
            container,
            endNode
          )
          mount(nextChildren as VNode, container, contextVNode, isSVG, endNode)
        } else if (nextChildFlags === ChildrenFlags.NO_CHILDREN) {
          queueRemoveChildren(
            prevChildren as MountedVNode[],
            container,
            endNode
          )
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
            queueRemoveChildren(
              prevChildren as MountedVNode[],
              container,
              endNode
            )
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
      patch(prevChild, nextChild, container, contextVNode, isSVG)
      prevChildren[i] = nextChild as MountedVNode
    }
    if (prevLength < nextLength) {
      for (i = commonLength; i < nextLength; i++) {
        mount(nextChildren[i], container, contextVNode, isSVG, endNode)
      }
    } else if (prevLength > nextLength) {
      for (i = commonLength; i < prevLength; i++) {
        queueRemoveVNode(prevChildren[i], container)
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
          nextVNode = nextChildren[j++]
          mount(nextVNode, container, contextVNode, isSVG, nextNode)
        }
      }
    } else if (j > nextEnd) {
      while (j <= prevEnd) {
        queueRemoveVNode(prevChildren[j++], container)
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
                    queueRemoveVNode(prevChildren[prevStart++], container)
                  }
                }
                if (pos > j) {
                  moved = true
                } else {
                  pos = j
                }
                patch(prevVNode, nextVNode, container, contextVNode, isSVG)
                patched++
                break
              }
            }
            if (!canRemoveWholeContent && j > nextEnd) {
              queueRemoveVNode(prevVNode, container)
            }
          } else if (!canRemoveWholeContent) {
            queueRemoveVNode(prevVNode, container)
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
                  queueRemoveVNode(prevChildren[prevStart++], container)
                }
              }
              nextVNode = nextChildren[j]
              sources[j - nextStart] = i + 1
              if (pos > j) {
                moved = true
              } else {
                pos = j
              }
              patch(prevVNode, nextVNode, container, contextVNode, isSVG)
              patched++
            } else if (!canRemoveWholeContent) {
              queueRemoveVNode(prevVNode, container)
            }
          } else if (!canRemoveWholeContent) {
            queueRemoveVNode(prevVNode, container)
          }
        }
      }
      // fast-path: if nothing patched remove all old and add all new
      if (canRemoveWholeContent) {
        queueRemoveChildren(prevChildren as MountedVNode[], container, endNode)
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
    const { flags, data, children, childFlags, ref, handle } = vnode
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
        // functional
        stop((handle as FunctionalHandle).runner)
        unmount(children as MountedVNode)
      }
    } else if (flags & VNodeFlags.PORTAL) {
      if (childFlags & ChildrenFlags.MULTIPLE_VNODES) {
        queueRemoveChildren(
          children as MountedVNode[],
          vnode.tag as RenderNode,
          null
        )
      } else if (childFlags === ChildrenFlags.SINGLE_VNODE) {
        queueRemoveVNode(children as MountedVNode, vnode.tag as RenderNode)
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

  function queueRemoveVNode(vnode: MountedVNode, container: RenderNode) {
    queueNodeOp([removeVNode, vnode, container])
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
    }
    ;(vnode as any).el = null
  }

  function queueRemoveChildren(
    children: MountedVNode[],
    container: RenderNode,
    refNode: RenderNode | null
  ) {
    queueNodeOp([removeChildren, children, container, refNode])
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
    container: RenderNode | null,
    isSVG: boolean,
    endNode: RenderNode | null
  ): Function {
    if (__DEV__) {
      pushWarningContext(vnode)
    }

    // a vnode may already have an instance if this is a compat call with
    // new Vue()
    const instance = ((__COMPAT__ && vnode.children) ||
      createComponentInstance(vnode as any)) as ComponentInstance

    // inject platform-specific unmount to keep-alive container
    if ((vnode.tag as any)[KeepAliveSymbol] === true) {
      ;(instance as any).$unmount = unmountComponentInstance
    }

    const {
      $proxy,
      $options: { beforeMount, renderTracked, renderTriggered }
    } = instance

    const queueUpdate = (instance.$forceUpdate = () => {
      queueJob(instance._updateHandle)
    })

    const autorunOptions: AutorunOptions = {
      scheduler: queueUpdate
    }

    if (__DEV__) {
      if (renderTracked) {
        autorunOptions.onTrack = event => {
          callLifecycleHookWithHandler(
            renderTracked,
            $proxy,
            ErrorTypes.RENDER_TRACKED,
            event
          )
        }
      }
      if (renderTriggered) {
        autorunOptions.onTrigger = event => {
          callLifecycleHookWithHandler(
            renderTriggered,
            $proxy,
            ErrorTypes.RENDER_TRIGGERED,
            event
          )
        }
      }
    }

    instance._updateHandle = autorun(() => {
      if (instance._unmounted) {
        return
      }
      if (instance._mounted) {
        updateComponentInstance(instance, isSVG)
      } else {
        if (beforeMount) {
          callLifecycleHookWithHandler(
            beforeMount,
            $proxy,
            ErrorTypes.BEFORE_MOUNT
          )
        }

        instance.$vnode = renderInstanceRoot(instance) as MountedVNode

        queuePostCommitCb(() => {
          vnode.el = instance.$vnode.el
          if (__COMPAT__) {
            // expose __vue__ for devtools
            ;(vnode.el as any).__vue__ = instance
          }
          if (vnode.ref) {
            vnode.ref($proxy)
          }
          // retrieve mounted value after initial render so that we get
          // to inject effects in hooks
          const { mounted } = instance.$options
          if (mounted) {
            callLifecycleHookWithHandler(mounted, $proxy, ErrorTypes.MOUNTED)
          }
          instance._mounted = true
        })

        mount(instance.$vnode, container, vnode as MountedVNode, isSVG, endNode)
      }
    }, autorunOptions)

    if (__DEV__) {
      popWarningContext()
    }

    // cleanup if mount is invalidated before committed
    return () => {
      teardownComponentInstance(instance)
    }
  }

  function updateComponentInstance(
    instance: ComponentInstance,
    isSVG: boolean
  ) {
    if (__DEV__ && instance.$parentVNode) {
      pushWarningContext(instance.$parentVNode as VNode)
    }

    const {
      $vnode: prevVNode,
      $parentVNode,
      $proxy,
      $options: { beforeUpdate }
    } = instance
    if (beforeUpdate) {
      callLifecycleHookWithHandler(
        beforeUpdate,
        $proxy,
        ErrorTypes.BEFORE_UPDATE,
        prevVNode
      )
    }

    const nextVNode = renderInstanceRoot(instance) as MountedVNode

    queuePostCommitCb(() => {
      instance.$vnode = nextVNode
      const el = nextVNode.el as RenderNode
      if (__COMPAT__) {
        // expose __vue__ for devtools
        ;(el as any).__vue__ = instance
      }
      // recursively update contextVNode el for nested HOCs
      if ((nextVNode.flags & VNodeFlags.PORTAL) === 0) {
        let vnode = $parentVNode
        while (vnode !== null) {
          if ((vnode.flags & VNodeFlags.COMPONENT) > 0) {
            vnode.el = el
          }
          vnode = vnode.contextVNode
        }
      }
      const { updated } = instance.$options
      if (updated) {
        callLifecycleHookWithHandler(
          updated,
          $proxy,
          ErrorTypes.UPDATED,
          nextVNode
        )
      }

      // TODO fix me
      // if (vnodeUpdatedHooks.length > 0) {
      //   const vnodeUpdatedHooksForCurrentInstance = vnodeUpdatedHooks.slice()
      //   vnodeUpdatedHooks.length = 0
      //   for (let i = 0; i < vnodeUpdatedHooksForCurrentInstance.length; i++) {
      //     vnodeUpdatedHooksForCurrentInstance[i]()
      //   }
      // }
    })

    const container = platformParentNode(prevVNode.el) as RenderNode
    patch(prevVNode, nextVNode, container, $parentVNode as MountedVNode, isSVG)

    if (__DEV__ && instance.$parentVNode) {
      popWarningContext()
    }
  }

  function unmountComponentInstance(instance: ComponentInstance) {
    if (instance._unmounted) {
      return
    }
    const {
      $vnode,
      $proxy,
      $options: { beforeUnmount, unmounted }
    } = instance
    if (beforeUnmount) {
      callLifecycleHookWithHandler(
        beforeUnmount,
        $proxy,
        ErrorTypes.BEFORE_UNMOUNT
      )
    }
    if ($vnode) {
      unmount($vnode)
    }
    teardownComponentInstance(instance)
    instance._unmounted = true
    if (unmounted) {
      callLifecycleHookWithHandler(unmounted, $proxy, ErrorTypes.UNMOUNTED)
    }
  }

  // Keep Alive ----------------------------------------------------------------

  function activateComponentInstance(
    vnode: VNode,
    container: RenderNode | null,
    endNode: RenderNode | null
  ) {
    if (__DEV__) {
      pushWarningContext(vnode)
    }
    const instance = vnode.children as ComponentInstance
    vnode.el = instance.$el as RenderNode
    if (container != null) {
      insertVNode(instance.$vnode, container, endNode)
    }
    if (__DEV__) {
      popWarningContext()
    }
    queuePostCommitCb(() => {
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
      const {
        $children,
        $proxy,
        $options: { activated }
      } = instance
      for (let i = 0; i < $children.length; i++) {
        callActivatedHook($children[i], false)
      }
      if (activated) {
        callLifecycleHookWithHandler(activated, $proxy, ErrorTypes.ACTIVATED)
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
      const {
        $children,
        $proxy,
        $options: { deactivated }
      } = instance
      for (let i = 0; i < $children.length; i++) {
        callDeactivateHook($children[i], false)
      }
      if (deactivated) {
        callLifecycleHookWithHandler(
          deactivated,
          $proxy,
          ErrorTypes.DEACTIVATED
        )
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

  function render(vnode: VNode | null, container: any) {
    const prevVNode = container.vnode
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
        queueRemoveVNode(prevVNode, container)
        container.vnode = null
      }
    }
    if (__COMPAT__) {
      flushPostCommitCbs()
      return vnode && vnode.flags & VNodeFlags.COMPONENT_STATEFUL
        ? (vnode.children as ComponentInstance).$proxy
        : null
    } else {
      return nextTick(() => {
        return vnode && vnode.flags & VNodeFlags.COMPONENT_STATEFUL
          ? (vnode.children as ComponentInstance).$proxy
          : null
      })
    }
  }

  return { render }
}

// https://en.wikipedia.org/wiki/Longest_increasing_subsequence
export function lis(arr: number[]): number[] {
  const p = arr.slice()
  const result = [0]
  let i
  let j
  let u
  let v
  let c
  const len = arr.length
  for (i = 0; i < len; i++) {
    const arrI = arr[i]
    if (arrI !== 0) {
      j = result[result.length - 1]
      if (arr[j] < arrI) {
        p[i] = j
        result.push(i)
        continue
      }
      u = 0
      v = result.length - 1
      while (u < v) {
        c = ((u + v) / 2) | 0
        if (arr[result[c]] < arrI) {
          u = c + 1
        } else {
          v = c
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1]
        }
        result[u] = i
      }
    }
  }
  u = result.length
  v = result[u - 1]
  while (u-- > 0) {
    result[u] = v
    v = p[v]
  }
  return result
}
