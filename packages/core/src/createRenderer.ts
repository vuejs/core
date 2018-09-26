import { autorun, stop } from '@vue/observer'
import { queueJob } from '@vue/scheduler'
import { VNodeFlags, ChildrenFlags } from './flags'
import { EMPTY_OBJ, reservedPropRE, lis } from './utils'
import {
  VNode,
  MountedVNode,
  MountedVNodes,
  RenderNode,
  createTextVNode,
  cloneVNode,
  Ref,
  VNodeChildren,
  RenderFragment
} from './vdom'
import {
  MountedComponent,
  FunctionalComponent,
  ComponentClass
} from './component'
import { updateProps, resolveProps } from './componentProps'
import {
  renderInstanceRoot,
  createComponentInstance,
  teardownComponentInstance,
  normalizeComponentRoot,
  shouldUpdateFunctionalComponent
} from './componentUtils'
import { KeepAliveSymbol } from './optional/keepAlive'

interface NodeOps {
  createElement: (tag: string, isSVG?: boolean) => any
  createText: (text: string) => any
  setText: (node: any, text: string) => void
  appendChild: (parent: any, child: any) => void
  insertBefore: (parent: any, child: any, ref: any) => void
  replaceChild: (parent: any, oldChild: any, newChild: any) => void
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
      replaceChild: platformReplaceChild,
      removeChild: platformRemoveChild,
      clearContent: platformClearContent,
      parentNode: platformParentNode,
      nextSibling: platformNextSibling,
      querySelector: platformQuerySelector
    },
    patchData: platformPatchData,
    teardownVNode
  } = options

  // Node operations (shimmed to handle virtual fragments) ---------------------

  function appendChild(container: RenderNode, el: RenderNode | RenderFragment) {
    if (el.$f) {
      for (let i = 0; i < el.children.length; i++) {
        appendChild(container, el.children[i])
      }
    } else {
      platformAppendChild(container, el)
    }
  }

  function insertBefore(
    container: RenderNode,
    el: RenderNode | RenderFragment,
    ref: RenderNode | RenderFragment
  ) {
    while (ref.$f) {
      ref = ref.children[0]
    }
    if (el.$f) {
      for (let i = 0; i < el.children.length; i++) {
        insertBefore(container, el.children[i], ref)
      }
    } else {
      platformInsertBefore(container, el, ref)
    }
  }

  function removeChild(container: RenderNode, el: RenderNode | RenderFragment) {
    if (el.$f) {
      for (let i = 0; i < el.children.length; i++) {
        removeChild(container, el.children[i])
      }
    } else {
      platformRemoveChild(container, el)
    }
  }

  function replaceChild(
    container: RenderNode,
    oldChild: RenderNode | RenderFragment,
    newChild: RenderNode | RenderFragment
  ) {
    if (oldChild.$f || newChild.$f) {
      insertOrAppend(container, newChild, oldChild)
      removeChild(container, oldChild)
    } else {
      platformReplaceChild(container, oldChild, newChild)
    }
  }

  function parentNode(el: RenderNode | RenderFragment): RenderNode {
    while (el.$f) {
      el = el.children[0]
    }
    return platformParentNode(el)
  }

  function insertOrAppend(
    container: RenderNode,
    newNode: RenderNode | RenderFragment,
    refNode: RenderNode | RenderFragment | null
  ) {
    if (refNode === null) {
      appendChild(container, newNode)
    } else {
      insertBefore(container, newNode, refNode)
    }
  }

  // lifecycle lifecycleHooks -----------------------------------------------------------

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
    parentComponent: MountedComponent | null,
    isSVG: boolean,
    endNode: RenderNode | RenderFragment | null
  ): RenderNode | RenderFragment {
    const { flags } = vnode
    if (flags & VNodeFlags.ELEMENT) {
      return mountElement(vnode, container, parentComponent, isSVG, endNode)
    } else if (flags & VNodeFlags.COMPONENT) {
      return mountComponent(vnode, container, parentComponent, isSVG, endNode)
    } else if (flags & VNodeFlags.TEXT) {
      return mountText(vnode, container, endNode)
    } else if (flags & VNodeFlags.FRAGMENT) {
      return mountFragment(vnode, container, parentComponent, isSVG, endNode)
    } else if (flags & VNodeFlags.PORTAL) {
      return mountPortal(vnode, container, parentComponent)
    } else {
      return platformCreateText('')
    }
  }

  function mountArrayChildren(
    children: VNode[],
    container: RenderNode | null,
    parentComponent: MountedComponent | null,
    isSVG: boolean,
    endNode: RenderNode | RenderFragment | null
  ) {
    for (let i = 0; i < children.length; i++) {
      let child = children[i]
      if (child.el) {
        children[i] = child = cloneVNode(child)
      }
      mount(children[i], container, parentComponent, isSVG, endNode)
    }
  }

  function mountElement(
    vnode: VNode,
    container: RenderNode | null,
    parentComponent: MountedComponent | null,
    isSVG: boolean,
    endNode: RenderNode | RenderFragment | null
  ): RenderNode {
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
        mount(children as VNode, el, parentComponent, hasSVGChildren, endNode)
      } else if (childFlags & ChildrenFlags.MULTIPLE_VNODES) {
        mountArrayChildren(
          children as VNode[],
          el,
          parentComponent,
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
    return el
  }

  function mountRef(ref: Ref, el: RenderNode | MountedComponent) {
    lifecycleHooks.push(() => {
      ref(el)
    })
  }

  function mountComponent(
    vnode: VNode,
    container: RenderNode | null,
    parentComponent: MountedComponent | null,
    isSVG: boolean,
    endNode: RenderNode | RenderFragment | null
  ): RenderNode | RenderFragment {
    let el: RenderNode | RenderFragment
    const { flags, tag, data, slots } = vnode
    if (flags & VNodeFlags.COMPONENT_STATEFUL) {
      if (flags & VNodeFlags.COMPONENT_STATEFUL_KEPT_ALIVE) {
        // kept-alive
        el = activateComponentInstance(vnode)
      } else {
        el = mountComponentInstance(
          vnode,
          tag as ComponentClass,
          null,
          parentComponent,
          isSVG,
          endNode
        )
      }
    } else {
      // functional component
      const render = tag as FunctionalComponent
      const { props, attrs } = resolveProps(data, render.props, render)
      const subTree = (vnode.children = normalizeComponentRoot(
        render(props, slots || EMPTY_OBJ, attrs || EMPTY_OBJ),
        vnode,
        attrs,
        render.inheritAttrs
      ))
      el = vnode.el = mount(subTree, null, parentComponent, isSVG, endNode)
    }
    if (container != null) {
      insertOrAppend(container, el, endNode)
    }
    return el
  }

  function mountText(
    vnode: VNode,
    container: RenderNode | null,
    endNode: RenderNode | RenderFragment | null
  ): RenderNode {
    const el = (vnode.el = platformCreateText(vnode.children as string))
    if (container != null) {
      insertOrAppend(container, el, endNode)
    }
    return el
  }

  function mountFragment(
    vnode: VNode,
    container: RenderNode | null,
    parentComponent: MountedComponent | null,
    isSVG: boolean,
    endNode: RenderNode | RenderFragment | null
  ): RenderFragment {
    const { children, childFlags } = vnode
    const fragment: RenderFragment = (vnode.el = {
      $f: true,
      children: []
    })
    const fragmentChildren = fragment.children
    if (childFlags & ChildrenFlags.SINGLE_VNODE) {
      fragmentChildren.push(
        mount(children as VNode, container, parentComponent, isSVG, endNode)
      )
    } else if (childFlags & ChildrenFlags.MULTIPLE_VNODES) {
      mountArrayChildren(
        children as VNode[],
        container,
        parentComponent,
        isSVG,
        endNode
      )
      for (let i = 0; i < (children as MountedVNodes).length; i++) {
        fragmentChildren.push((children as MountedVNodes)[i].el)
      }
    } else {
      // ensure at least one children so that it can be used as a ref node
      // during insertions
      fragmentChildren.push(mountText(createTextVNode(''), container, endNode))
    }
    return fragment
  }

  function mountPortal(
    vnode: VNode,
    container: RenderNode | null,
    parentComponent: MountedComponent | null
  ): RenderNode {
    const { tag, children, childFlags, ref } = vnode
    const target = typeof tag === 'string' ? platformQuerySelector(tag) : tag

    if (__DEV__ && !target) {
      // TODO warn poartal target not found
    }

    if (childFlags & ChildrenFlags.SINGLE_VNODE) {
      mount(
        children as VNode,
        target as RenderNode,
        parentComponent,
        false,
        null
      )
    } else if (childFlags & ChildrenFlags.MULTIPLE_VNODES) {
      mountArrayChildren(
        children as VNode[],
        target as RenderNode,
        parentComponent,
        false,
        null
      )
    }
    if (ref) {
      mountRef(ref, target as RenderNode)
    }
    return (vnode.el = mountText(createTextVNode(''), container, null))
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
    prevVNode: VNode,
    nextVNode: VNode,
    container: RenderNode,
    parentComponent: MountedComponent | null,
    isSVG: boolean
  ) {
    const nextFlags = nextVNode.flags
    const prevFlags = prevVNode.flags

    if (prevFlags !== nextFlags) {
      replaceVNode(prevVNode, nextVNode, container, parentComponent, isSVG)
    } else if (nextFlags & VNodeFlags.ELEMENT) {
      patchElement(prevVNode, nextVNode, container, parentComponent, isSVG)
    } else if (nextFlags & VNodeFlags.COMPONENT) {
      patchComponent(prevVNode, nextVNode, container, parentComponent, isSVG)
    } else if (nextFlags & VNodeFlags.TEXT) {
      patchText(prevVNode, nextVNode)
    } else if (nextFlags & VNodeFlags.FRAGMENT) {
      patchFragment(prevVNode, nextVNode, container, parentComponent, isSVG)
    } else if (nextFlags & VNodeFlags.PORTAL) {
      patchPortal(prevVNode, nextVNode, parentComponent)
    }
  }

  function patchElement(
    prevVNode: VNode,
    nextVNode: VNode,
    container: RenderNode,
    parentComponent: MountedComponent | null,
    isSVG: boolean
  ) {
    const { flags, tag } = nextVNode
    isSVG = isSVG || (flags & VNodeFlags.ELEMENT_SVG) > 0

    if (prevVNode.tag !== tag) {
      replaceVNode(prevVNode, nextVNode, container, parentComponent, isSVG)
      return
    }

    const el = (nextVNode.el = prevVNode.el) as RenderNode
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
      parentComponent,
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
    prevVNode: VNode,
    nextVNode: VNode,
    container: RenderNode,
    parentComponent: MountedComponent | null,
    isSVG: boolean
  ) {
    const { tag, flags } = nextVNode
    if (tag !== prevVNode.tag) {
      replaceVNode(prevVNode, nextVNode, container, parentComponent, isSVG)
    } else if (flags & VNodeFlags.COMPONENT_STATEFUL) {
      patchStatefulComponent(prevVNode, nextVNode)
    } else {
      patchFunctionalComponent(
        prevVNode,
        nextVNode,
        container,
        parentComponent,
        isSVG
      )
    }
  }

  function patchStatefulComponent(prevVNode: VNode, nextVNode: VNode) {
    const { childFlags: prevChildFlags } = prevVNode
    const {
      data: nextData,
      slots: nextSlots,
      childFlags: nextChildFlags
    } = nextVNode

    const instance = (nextVNode.children =
      prevVNode.children) as MountedComponent
    instance.$slots = nextSlots || EMPTY_OBJ
    instance.$parentVNode = nextVNode

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
      instance.$vnode.parentVNode = nextVNode
    }
    nextVNode.el = instance.$vnode.el
  }

  function patchFunctionalComponent(
    prevVNode: VNode,
    nextVNode: VNode,
    container: RenderNode,
    parentComponent: MountedComponent | null,
    isSVG: boolean
  ) {
    // functional component tree is stored on the vnode as `children`
    const { data: prevData, slots: prevSlots } = prevVNode
    const { data: nextData, slots: nextSlots } = nextVNode
    const render = nextVNode.tag as FunctionalComponent
    const prevTree = prevVNode.children as VNode

    let shouldUpdate = true
    if (render.pure && prevSlots == null && nextSlots == null) {
      shouldUpdate = shouldUpdateFunctionalComponent(prevData, nextData)
    }

    if (shouldUpdate) {
      const { props, attrs } = resolveProps(nextData, render.props, render)
      const nextTree = (nextVNode.children = normalizeComponentRoot(
        render(props, nextSlots || EMPTY_OBJ, attrs || EMPTY_OBJ),
        nextVNode,
        attrs,
        render.inheritAttrs
      ))
      patch(prevTree, nextTree, container, parentComponent, isSVG)
      nextVNode.el = nextTree.el
    } else if (prevTree.flags & VNodeFlags.COMPONENT) {
      // functional component returned another component
      prevTree.parentVNode = nextVNode
    }
  }

  function patchFragment(
    prevVNode: VNode,
    nextVNode: VNode,
    container: RenderNode,
    parentComponent: MountedComponent | null,
    isSVG: boolean
  ) {
    // determine the tail node of the previous fragment,
    // then retrieve its next sibling to use as the end node for patchChildren.
    let prevElement = prevVNode.el as RenderNode | RenderFragment
    while (prevElement.$f) {
      prevElement = prevElement.children[prevElement.children.length - 1]
    }
    const { children, childFlags } = nextVNode
    patchChildren(
      prevVNode.childFlags,
      childFlags,
      prevVNode.children,
      children,
      container,
      parentComponent,
      isSVG,
      platformNextSibling(prevElement)
    )
    nextVNode.el = prevVNode.el as RenderFragment
    const fragmentChildren: (
      | RenderNode
      | RenderFragment)[] = (nextVNode.el.children = [])
    if (childFlags & ChildrenFlags.SINGLE_VNODE) {
      fragmentChildren.push((children as MountedVNode).el)
    } else if (childFlags & ChildrenFlags.MULTIPLE_VNODES) {
      for (let i = 0; i < (children as MountedVNodes).length; i++) {
        fragmentChildren.push((children as MountedVNodes)[i].el)
      }
    } else {
      fragmentChildren.push(mountText(createTextVNode(''), null, null))
    }
  }

  function patchText(prevVNode: VNode, nextVNode: VNode) {
    const el = (nextVNode.el = prevVNode.el) as RenderNode
    const nextText = nextVNode.children
    if (nextText !== prevVNode.children) {
      platformSetText(el, nextText as string)
    }
  }

  function patchPortal(
    prevVNode: VNode,
    nextVNode: VNode,
    parentComponent: MountedComponent | null
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
      parentComponent,
      false,
      null
    )
    nextVNode.el = prevVNode.el
    if (nextContainer !== prevContainer) {
      switch (nextVNode.childFlags) {
        case ChildrenFlags.SINGLE_VNODE:
          appendChild(nextContainer, (nextChildren as MountedVNode).el)
          break
        case ChildrenFlags.NO_CHILDREN:
          break
        default:
          for (let i = 0; i < (nextChildren as MountedVNodes).length; i++) {
            appendChild(nextContainer, (nextChildren as MountedVNodes)[i].el)
          }
          break
      }
    }
  }

  function replaceVNode(
    prevVNode: VNode,
    nextVNode: VNode,
    container: RenderNode,
    parentComponent: MountedComponent | null,
    isSVG: boolean
  ) {
    unmount(prevVNode)
    replaceChild(
      container,
      prevVNode.el as RenderNode | RenderFragment,
      mount(nextVNode, null, parentComponent, isSVG, null)
    )
  }

  function patchChildren(
    prevChildFlags: ChildrenFlags,
    nextChildFlags: ChildrenFlags,
    prevChildren: VNodeChildren,
    nextChildren: VNodeChildren,
    container: RenderNode,
    parentComponent: MountedComponent | null,
    isSVG: boolean,
    endNode: RenderNode | RenderFragment | null
  ) {
    switch (prevChildFlags) {
      case ChildrenFlags.SINGLE_VNODE:
        switch (nextChildFlags) {
          case ChildrenFlags.SINGLE_VNODE:
            patch(
              prevChildren as VNode,
              nextChildren as VNode,
              container,
              parentComponent,
              isSVG
            )
            break
          case ChildrenFlags.NO_CHILDREN:
            remove(prevChildren as VNode, container)
            break
          default:
            remove(prevChildren as VNode, container)
            mountArrayChildren(
              nextChildren as VNode[],
              container,
              parentComponent,
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
              parentComponent,
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
              parentComponent,
              isSVG,
              endNode
            )
            break
        }
        break
      default:
        // MULTIPLE_CHILDREN
        if (nextChildFlags === ChildrenFlags.SINGLE_VNODE) {
          removeAll(prevChildren as MountedVNodes, container, endNode)
          mount(
            nextChildren as VNode,
            container,
            parentComponent,
            isSVG,
            endNode
          )
        } else if (nextChildFlags === ChildrenFlags.NO_CHILDREN) {
          removeAll(prevChildren as MountedVNodes, container, endNode)
        } else {
          const prevLength = (prevChildren as VNode[]).length
          const nextLength = (nextChildren as VNode[]).length
          if (prevLength === 0) {
            if (nextLength > 0) {
              mountArrayChildren(
                nextChildren as VNode[],
                container,
                parentComponent,
                isSVG,
                endNode
              )
            }
          } else if (nextLength === 0) {
            removeAll(prevChildren as MountedVNodes, container, endNode)
          } else if (
            prevChildFlags === ChildrenFlags.KEYED_VNODES &&
            nextChildFlags === ChildrenFlags.KEYED_VNODES
          ) {
            patchKeyedChildren(
              prevChildren as VNode[],
              nextChildren as VNode[],
              container,
              prevLength,
              nextLength,
              parentComponent,
              isSVG,
              endNode
            )
          } else {
            patchNonKeyedChildren(
              prevChildren as VNode[],
              nextChildren as VNode[],
              container,
              prevLength,
              nextLength,
              parentComponent,
              isSVG,
              endNode
            )
          }
        }
        break
    }
  }

  function patchNonKeyedChildren(
    prevChildren: VNode[],
    nextChildren: VNode[],
    container: RenderNode,
    prevLength: number,
    nextLength: number,
    parentComponent: MountedComponent | null,
    isSVG: boolean,
    endNode: RenderNode | RenderFragment | null
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
      patch(prevChild, nextChild, container, parentComponent, isSVG)
      prevChildren[i] = nextChild
    }
    if (prevLength < nextLength) {
      for (i = commonLength; i < nextLength; i++) {
        nextChild = nextChildren[i]
        if (nextChild.el) {
          nextChildren[i] = nextChild = cloneVNode(nextChild)
        }
        mount(nextChild, container, parentComponent, isSVG, endNode)
      }
    } else if (prevLength > nextLength) {
      for (i = commonLength; i < prevLength; i++) {
        remove(prevChildren[i], container)
      }
    }
  }

  function patchKeyedChildren(
    prevChildren: VNode[],
    nextChildren: VNode[],
    container: RenderNode,
    prevLength: number,
    nextLength: number,
    parentComponent: MountedComponent | null,
    isSVG: boolean,
    endNode: RenderNode | RenderFragment | null
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
        patch(prevVNode, nextVNode, container, parentComponent, isSVG)
        prevChildren[j] = nextVNode
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
        patch(prevVNode, nextVNode, container, parentComponent, isSVG)
        prevChildren[prevEnd] = nextVNode
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
          mount(nextVNode, container, parentComponent, isSVG, nextNode)
        }
      }
    } else if (j > nextEnd) {
      while (j <= prevEnd) {
        remove(prevChildren[j++], container)
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
                    remove(prevChildren[prevStart++], container)
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
                patch(prevVNode, nextVNode, container, parentComponent, isSVG)
                patched++
                break
              }
            }
            if (!canRemoveWholeContent && j > nextEnd) {
              remove(prevVNode, container)
            }
          } else if (!canRemoveWholeContent) {
            remove(prevVNode, container)
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
                  remove(prevChildren[prevStart++], container)
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
              patch(prevVNode, nextVNode, container, parentComponent, isSVG)
              patched++
            } else if (!canRemoveWholeContent) {
              remove(prevVNode, container)
            }
          } else if (!canRemoveWholeContent) {
            remove(prevVNode, container)
          }
        }
      }
      // fast-path: if nothing patched remove all old and add all new
      if (canRemoveWholeContent) {
        removeAll(prevChildren as MountedVNodes, container, endNode)
        mountArrayChildren(
          nextChildren,
          container,
          parentComponent,
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
                parentComponent,
                isSVG,
                nextPos < nextLength ? nextChildren[nextPos].el : endNode
              )
            } else if (j < 0 || i !== seq[j]) {
              pos = i + nextStart
              nextVNode = nextChildren[pos]
              nextPos = pos + 1
              insertOrAppend(
                container,
                nextVNode.el as RenderNode | RenderFragment,
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
                parentComponent,
                isSVG,
                nextPos < nextLength ? nextChildren[nextPos].el : endNode
              )
            }
          }
        }
      }
    }
  }

  // unmounting ----------------------------------------------------------------

  function unmount(vnode: VNode) {
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
          deactivateComponentInstance(children as MountedComponent)
        } else {
          unmountComponentInstance(children as MountedComponent)
        }
      } else {
        unmount(children as VNode)
      }
    } else if (flags & VNodeFlags.PORTAL) {
      if (childFlags & ChildrenFlags.MULTIPLE_VNODES) {
        removeAll(children as MountedVNodes, vnode.tag as RenderNode, null)
      } else if (childFlags === ChildrenFlags.SINGLE_VNODE) {
        remove(children as VNode, vnode.tag as RenderNode)
      }
    }
    if (ref) {
      ref(null)
    }
  }

  function unmountChildren(children: VNodeChildren, childFlags: ChildrenFlags) {
    if (childFlags & ChildrenFlags.MULTIPLE_VNODES) {
      unmountArrayChildren(children as VNode[])
    } else if (childFlags === ChildrenFlags.SINGLE_VNODE) {
      unmount(children as VNode)
    }
  }

  function unmountArrayChildren(children: VNode[]) {
    for (let i = 0; i < children.length; i++) {
      unmount(children[i])
    }
  }

  function remove(vnode: VNode, container: RenderNode) {
    unmount(vnode)
    if (container && vnode.el) {
      removeChild(container, vnode.el)
      vnode.el = null
    }
  }

  function removeAll(
    children: MountedVNodes,
    container: RenderNode,
    ref: RenderNode | RenderFragment | null
  ) {
    unmountArrayChildren(children)
    if (ref === null) {
      platformClearContent(container)
    } else {
      for (let i = 0; i < children.length; i++) {
        removeChild(container, children[i].el as RenderNode | RenderFragment)
      }
    }
  }

  // Component lifecycle -------------------------------------------------------

  function mountComponentInstance(
    parentVNode: VNode,
    Component: ComponentClass,
    container: RenderNode | null,
    parentComponent: MountedComponent | null,
    isSVG: boolean,
    endNode: RenderNode | RenderFragment | null
  ): RenderNode {
    // a vnode may already have an instance if this is a compat call with
    // new Vue()
    const instance =
      (__COMPAT__ && (parentVNode.children as MountedComponent)) ||
      createComponentInstance(parentVNode, Component, parentComponent)

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
          updateComponentInstance(instance, container, isSVG)
        } else {
          // this will be executed synchronously right here
          instance.$vnode = renderInstanceRoot(instance)
          parentVNode.el = mount(
            instance.$vnode,
            container,
            instance,
            isSVG,
            endNode
          )
          instance._mounted = true
          mountComponentInstanceCallbacks(instance, parentVNode.ref)
        }
      },
      {
        scheduler: queueUpdate,
        onTrack: instance.renderTracked,
        onTrigger: instance.renderTriggered
      }
    )

    return parentVNode.el as RenderNode
  }

  function mountComponentInstanceCallbacks(
    instance: MountedComponent,
    ref: Ref | null
  ) {
    if (ref) {
      mountRef(ref, instance)
    }
    if (instance.mounted) {
      lifecycleHooks.push(() => {
        ;(instance as any).mounted.call(instance.$proxy)
      })
    }
  }

  function updateComponentInstance(
    instance: MountedComponent,
    container: RenderNode | null,
    isSVG: boolean
  ) {
    const prevVNode = instance.$vnode

    if (instance.beforeUpdate) {
      instance.beforeUpdate.call(instance.$proxy, prevVNode)
    }

    const nextVNode = (instance.$vnode = renderInstanceRoot(instance))
    container =
      container || parentNode(prevVNode.el as RenderNode | RenderFragment)
    patch(prevVNode, nextVNode, container, instance, isSVG)
    const el = nextVNode.el as RenderNode

    // recursively update parentVNode el for nested HOCs
    if ((nextVNode.flags & VNodeFlags.PORTAL) === 0) {
      let vnode = instance.$parentVNode
      while (vnode !== null) {
        if ((vnode.flags & VNodeFlags.COMPONENT) > 0) {
          vnode.el = el
        }
        vnode = vnode.parentVNode
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
  }

  function unmountComponentInstance(instance: MountedComponent) {
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

  function activateComponentInstance(vnode: VNode): RenderNode {
    const instance = vnode.children as MountedComponent
    const el = (vnode.el = instance.$el)
    lifecycleHooks.push(() => {
      callActivatedHook(instance, true)
    })
    return el as RenderNode
  }

  function callActivatedHook(instance: MountedComponent, asRoot: boolean) {
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

  function deactivateComponentInstance(instance: MountedComponent) {
    callDeactivateHook(instance, true)
  }

  function callDeactivateHook(instance: MountedComponent, asRoot: boolean) {
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

  function isInInactiveTree(instance: MountedComponent): boolean {
    while ((instance = instance.$parent as any) !== null) {
      if (instance._inactiveRoot) return true
    }
    return false
  }

  // TODO hydrating ------------------------------------------------------------

  // API -----------------------------------------------------------------------

  function render(vnode: VNode | null, container: any) {
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
        remove(prevVNode, container)
        container.vnode = null
      }
    }
    flushHooks()
    return vnode && vnode.flags & VNodeFlags.COMPONENT_STATEFUL
      ? (vnode.children as MountedComponent).$proxy
      : null
  }

  return { render }
}
