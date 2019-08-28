import {
  Text,
  Fragment,
  Empty,
  Portal,
  normalizeVNode,
  VNode,
  VNodeChildren
} from './vnode'
import {
  ComponentInstance,
  renderComponentRoot,
  shouldUpdateComponent,
  createComponentInstance,
  setupStatefulComponent
} from './component'
import {
  isString,
  EMPTY_OBJ,
  EMPTY_ARR,
  isReservedProp,
  isFunction
} from '@vue/shared'
import { queueJob, queuePostFlushCb, flushPostFlushCbs } from './scheduler'
import {
  effect,
  stop,
  ReactiveEffectOptions,
  isRef,
  Ref,
  toRaw
} from '@vue/reactivity'
import { resolveProps } from './componentProps'
import { resolveSlots } from './componentSlots'
import { PatchFlags } from './patchFlags'
import { ShapeFlags } from './shapeFlags'

const prodEffectOptions = {
  scheduler: queueJob
}

function createDevEffectOptions(
  instance: ComponentInstance
): ReactiveEffectOptions {
  return {
    scheduler: queueJob,
    onTrack: instance.rtc
      ? e => invokeHooks(instance.rtc as Function[], e)
      : void 0,
    onTrigger: instance.rtg
      ? e => invokeHooks(instance.rtg as Function[], e)
      : void 0
  }
}

function isSameType(n1: VNode, n2: VNode): boolean {
  return n1.type === n2.type && n1.key === n2.key
}

function invokeHooks(hooks: Function[], arg?: any) {
  for (let i = 0; i < hooks.length; i++) {
    hooks[i](arg)
  }
}

export type HostNode = any

export interface RendererOptions {
  patchProp(
    el: HostNode,
    key: string,
    value: any,
    oldValue: any,
    isSVG: boolean,
    prevChildren?: VNode[],
    parentComponent?: ComponentInstance | null,
    unmountChildren?: (
      children: VNode[],
      parentComponent: ComponentInstance | null
    ) => void
  ): void
  insert(el: HostNode, parent: HostNode, anchor?: HostNode): void
  remove(el: HostNode): void
  createElement(type: string, isSVG?: boolean): HostNode
  createText(text: string): HostNode
  createComment(text: string): HostNode
  setText(node: HostNode, text: string): void
  setElementText(node: HostNode, text: string): void
  parentNode(node: HostNode): HostNode | null
  nextSibling(node: HostNode): HostNode | null
  querySelector(selector: string): HostNode | null
}

export function createRenderer(options: RendererOptions) {
  const {
    insert: hostInsert,
    remove: hostRemove,
    patchProp: hostPatchProp,
    createElement: hostCreateElement,
    createText: hostCreateText,
    createComment: hostCreateComment,
    setText: hostSetText,
    setElementText: hostSetElementText,
    parentNode: hostParentNode,
    nextSibling: hostNextSibling,
    querySelector: hostQuerySelector
  } = options

  function patch(
    n1: VNode | null, // null means this is a mount
    n2: VNode,
    container: HostNode,
    anchor: HostNode = null,
    parentComponent: ComponentInstance | null = null,
    isSVG: boolean = false,
    optimized: boolean = false
  ) {
    // patching & not same type, unmount old tree
    if (n1 != null && !isSameType(n1, n2)) {
      anchor = getNextHostNode(n1)
      unmount(n1, parentComponent, true)
      n1 = null
    }

    const { type, shapeFlag } = n2
    switch (type) {
      case Text:
        processText(n1, n2, container, anchor)
        break
      case Empty:
        processEmptyNode(n1, n2, container, anchor)
        break
      case Fragment:
        processFragment(
          n1,
          n2,
          container,
          anchor,
          parentComponent,
          isSVG,
          optimized
        )
        break
      case Portal:
        processPortal(
          n1,
          n2,
          container,
          anchor,
          parentComponent,
          isSVG,
          optimized
        )
        break
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          processElement(
            n1,
            n2,
            container,
            anchor,
            parentComponent,
            isSVG,
            optimized
          )
        } else {
          if (
            __DEV__ &&
            !(shapeFlag & ShapeFlags.STATEFUL_COMPONENT) &&
            !(shapeFlag & ShapeFlags.FUNCTIONAL_COMPONENT)
          ) {
            // TODO warn invalid node type
            debugger
          }
          processComponent(
            n1,
            n2,
            container,
            anchor,
            parentComponent,
            isSVG,
            optimized
          )
        }
        break
    }
  }

  function processText(
    n1: VNode | null,
    n2: VNode,
    container: HostNode,
    anchor: HostNode
  ) {
    if (n1 == null) {
      hostInsert(
        (n2.el = hostCreateText(n2.children as string)),
        container,
        anchor
      )
    } else {
      const el = (n2.el = n1.el)
      if (n2.children !== n1.children) {
        hostSetText(el, n2.children as string)
      }
    }
  }

  function processEmptyNode(
    n1: VNode | null,
    n2: VNode,
    container: HostNode,
    anchor: HostNode
  ) {
    if (n1 == null) {
      hostInsert((n2.el = hostCreateComment('')), container, anchor)
    } else {
      n2.el = n1.el
    }
  }

  function processElement(
    n1: VNode | null,
    n2: VNode,
    container: HostNode,
    anchor: HostNode,
    parentComponent: ComponentInstance | null,
    isSVG: boolean,
    optimized: boolean
  ) {
    if (n1 == null) {
      mountElement(n2, container, anchor, parentComponent, isSVG)
    } else {
      patchElement(n1, n2, parentComponent, isSVG, optimized)
    }
    if (n2.ref !== null && parentComponent !== null) {
      setRef(n2.ref, n1 && n1.ref, parentComponent, n2.el)
    }
  }

  function mountElement(
    vnode: VNode,
    container: HostNode,
    anchor: HostNode,
    parentComponent: ComponentInstance | null,
    isSVG: boolean
  ) {
    const tag = vnode.type as string
    isSVG = isSVG || tag === 'svg'
    const el = (vnode.el = hostCreateElement(tag, isSVG))
    const { props, shapeFlag } = vnode
    if (props != null) {
      for (const key in props) {
        if (isReservedProp(key)) continue
        hostPatchProp(el, key, props[key], null, isSVG)
      }
    }
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      hostSetElementText(el, vnode.children as string)
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      mountChildren(
        vnode.children as VNodeChildren,
        el,
        null,
        parentComponent,
        isSVG
      )
    }
    hostInsert(el, container, anchor)
  }

  function mountChildren(
    children: VNodeChildren,
    container: HostNode,
    anchor: HostNode,
    parentComponent: ComponentInstance | null,
    isSVG: boolean,
    start: number = 0
  ) {
    for (let i = start; i < children.length; i++) {
      const child = (children[i] = normalizeVNode(children[i]))
      patch(null, child, container, anchor, parentComponent, isSVG)
    }
  }

  function patchElement(
    n1: VNode,
    n2: VNode,
    parentComponent: ComponentInstance | null,
    isSVG: boolean,
    optimized: boolean
  ) {
    const el = (n2.el = n1.el)
    const { patchFlag, dynamicChildren } = n2
    const oldProps = (n1 && n1.props) || EMPTY_OBJ
    const newProps = n2.props || EMPTY_OBJ

    if (patchFlag) {
      // the presence of a patchFlag means this element's render code was
      // generated by the compiler and can take the fast path.
      // in this path old node and new node are guaranteed to have the same shape
      // (i.e. at the exact same position in the source template)

      if (patchFlag & PatchFlags.FULL_PROPS) {
        // element props contain dynamic keys, full diff needed
        patchProps(el, n2, oldProps, newProps, parentComponent, isSVG)
      } else {
        // class
        // this flag is matched when the element has dynamic class bindings.
        if (patchFlag & PatchFlags.CLASS) {
          if (oldProps.class !== newProps.class) {
            hostPatchProp(el, 'class', newProps.class, null, isSVG)
          }
        }

        // style
        // this flag is matched when the element has dynamic style bindings
        if (patchFlag & PatchFlags.STYLE) {
          hostPatchProp(el, 'style', newProps.style, oldProps.style, isSVG)
        }

        // props
        // This flag is matched when the element has dynamic prop/attr bindings
        // other than class and style. The keys of dynamic prop/attrs are saved for
        // faster iteration.
        // Note dynamic keys like :[foo]="bar" will cause this optimization to
        // bail out and go through a full diff because we need to unset the old key
        if (patchFlag & PatchFlags.PROPS) {
          // if the flag is present then dynamicProps must be non-null
          const propsToUpdate = n2.dynamicProps as string[]
          for (let i = 0; i < propsToUpdate.length; i++) {
            const key = propsToUpdate[i]
            const prev = oldProps[key]
            const next = newProps[key]
            if (prev !== next) {
              hostPatchProp(
                el,
                key,
                next,
                prev,
                isSVG,
                n1.children as VNode[],
                parentComponent,
                unmountChildren
              )
            }
          }
        }
      }

      // text
      // This flag is matched when the element has only dynamic text children.
      // this flag is terminal (i.e. skips children diffing).
      if (patchFlag & PatchFlags.TEXT) {
        if (n1.children !== n2.children) {
          hostSetElementText(el, n2.children as string)
        }
        return // terminal
      }
    } else if (!optimized) {
      // unoptimized, full diff
      patchProps(el, n2, oldProps, newProps, parentComponent, isSVG)
    }

    if (dynamicChildren != null) {
      // children fast path
      const olddynamicChildren = n1.dynamicChildren as VNode[]
      for (let i = 0; i < dynamicChildren.length; i++) {
        patch(
          olddynamicChildren[i],
          dynamicChildren[i],
          el,
          null,
          parentComponent,
          isSVG,
          true
        )
      }
    } else if (!optimized) {
      // full diff
      patchChildren(n1, n2, el, null, parentComponent, isSVG)
    }
  }

  function patchProps(
    el: HostNode,
    vnode: VNode,
    oldProps: any,
    newProps: any,
    parentComponent: ComponentInstance | null,
    isSVG: boolean
  ) {
    if (oldProps !== newProps) {
      for (const key in newProps) {
        if (isReservedProp(key)) continue
        const next = newProps[key]
        const prev = oldProps[key]
        if (next !== prev) {
          hostPatchProp(
            el,
            key,
            next,
            prev,
            isSVG,
            vnode.children as VNode[],
            parentComponent,
            unmountChildren
          )
        }
      }
      if (oldProps !== EMPTY_OBJ) {
        for (const key in oldProps) {
          if (isReservedProp(key)) continue
          if (!(key in newProps)) {
            hostPatchProp(
              el,
              key,
              null,
              null,
              isSVG,
              vnode.children as VNode[],
              parentComponent,
              unmountChildren
            )
          }
        }
      }
    }
  }

  function processFragment(
    n1: VNode | null,
    n2: VNode,
    container: HostNode,
    anchor: HostNode,
    parentComponent: ComponentInstance | null,
    isSVG: boolean,
    optimized: boolean
  ) {
    const fragmentStartAnchor = (n2.el = n1 ? n1.el : hostCreateComment(''))
    const fragmentEndAnchor = (n2.anchor = n1
      ? n1.anchor
      : hostCreateComment(''))
    if (n1 == null) {
      hostInsert(fragmentStartAnchor, container, anchor)
      hostInsert(fragmentEndAnchor, container, anchor)
      // a fragment can only have array children
      mountChildren(
        n2.children as VNodeChildren,
        container,
        fragmentEndAnchor,
        parentComponent,
        isSVG
      )
    } else {
      patchChildren(
        n1,
        n2,
        container,
        fragmentEndAnchor,
        parentComponent,
        isSVG,
        optimized
      )
    }
  }

  function processPortal(
    n1: VNode | null,
    n2: VNode,
    container: HostNode,
    anchor: HostNode,
    parentComponent: ComponentInstance | null,
    isSVG: boolean,
    optimized: boolean
  ) {
    const targetSelector = n2.props && n2.props.target
    const { patchFlag, shapeFlag, children } = n2
    if (n1 == null) {
      const target = (n2.target = isString(targetSelector)
        ? hostQuerySelector(targetSelector)
        : null)
      if (target != null) {
        if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
          hostSetElementText(target, children as string)
        } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          mountChildren(
            children as VNodeChildren,
            target,
            null,
            parentComponent,
            isSVG
          )
        }
      } else {
        // TODO warn missing or invalid target
      }
    } else {
      // update content
      const target = (n2.target = n1.target)
      if (patchFlag === PatchFlags.TEXT) {
        hostSetElementText(target, children as string)
      } else if (!optimized) {
        patchChildren(n1, n2, target, null, parentComponent, isSVG)
      }
      // target changed
      if (targetSelector !== (n1.props && n1.props.target)) {
        const nextTarget = (n2.target = isString(targetSelector)
          ? hostQuerySelector(targetSelector)
          : null)
        if (nextTarget != null) {
          // move content
          if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
            hostSetElementText(target, '')
            hostSetElementText(nextTarget, children as string)
          } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
            for (let i = 0; i < (children as VNode[]).length; i++) {
              move((children as VNode[])[i], nextTarget, null)
            }
          }
        } else {
          // TODO warn missing or invalid target
        }
      }
    }
    // insert an empty node as the placeholder for the portal
    processEmptyNode(n1, n2, container, anchor)
  }

  function processComponent(
    n1: VNode | null,
    n2: VNode,
    container: HostNode,
    anchor: HostNode,
    parentComponent: ComponentInstance | null,
    isSVG: boolean,
    optimized: boolean
  ) {
    if (n1 == null) {
      mountComponent(n2, container, anchor, parentComponent, isSVG)
    } else {
      const instance = (n2.component = n1.component) as ComponentInstance
      if (shouldUpdateComponent(n1, n2, optimized)) {
        instance.next = n2
        instance.update()
      } else {
        n2.component = n1.component
        n2.el = n1.el
      }
    }
    if (n2.ref !== null && parentComponent !== null) {
      setRef(
        n2.ref,
        n1 && n1.ref,
        parentComponent,
        (n2.component as ComponentInstance).renderProxy
      )
    }
  }

  function mountComponent(
    initialVNode: VNode,
    container: HostNode,
    anchor: HostNode,
    parentComponent: ComponentInstance | null,
    isSVG: boolean
  ) {
    const instance: ComponentInstance = (initialVNode.component = createComponentInstance(
      initialVNode,
      parentComponent
    ))

    // resolve props and slots for setup context
    const propsOptions = (initialVNode.type as any).props
    resolveProps(instance, initialVNode.props, propsOptions)
    resolveSlots(instance, initialVNode.children)

    // setup stateful logic
    if (initialVNode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
      setupStatefulComponent(instance)
    }

    // create reactive effect for rendering
    let mounted = false
    instance.update = effect(function componentEffect() {
      if (!mounted) {
        const subTree = (instance.subTree = renderComponentRoot(instance))
        // beforeMount hook
        if (instance.bm !== null) {
          invokeHooks(instance.bm)
        }
        patch(null, subTree, container, anchor, instance, isSVG)
        initialVNode.el = subTree.el
        // mounted hook
        if (instance.m !== null) {
          queuePostFlushCb(instance.m)
        }
        mounted = true
      } else {
        // updateComponent
        // This is triggered by mutation of component's own state (next: null)
        // OR parent calling processComponent (next: VNode)
        const { next } = instance
        if (next !== null) {
          // update from parent
          next.component = instance
          instance.vnode = next
          instance.next = null
          resolveProps(instance, next.props, propsOptions)
          resolveSlots(instance, next.children)
        }
        const prevTree = instance.subTree
        const nextTree = (instance.subTree = renderComponentRoot(instance))
        // beforeUpdate hook
        if (instance.bu !== null) {
          invokeHooks(instance.bu)
        }
        // reset refs
        // only needed if previous patch had refs
        if (instance.refs !== EMPTY_OBJ) {
          instance.refs = {}
        }
        patch(
          prevTree,
          nextTree,
          // parent may have changed if it's in a portal
          hostParentNode(prevTree.el),
          // anchor may have changed if it's in a fragment
          getNextHostNode(prevTree),
          instance,
          isSVG
        )
        let current = instance.vnode
        current.el = nextTree.el
        if (next === null) {
          // self-triggered update. In case of HOC, update parent component
          // vnode el. HOC is indicated by parent instance's subTree pointing
          // to child component's vnode
          let parent = instance.parent
          while (parent && parent.subTree === current) {
            ;(current = parent.vnode).el = nextTree.el
            parent = parent.parent
          }
        }
        // upated hook
        if (instance.u !== null) {
          queuePostFlushCb(instance.u)
        }
      }
    }, __DEV__ ? createDevEffectOptions(instance) : prodEffectOptions)
  }

  function patchChildren(
    n1: VNode | null,
    n2: VNode,
    container: HostNode,
    anchor: HostNode,
    parentComponent: ComponentInstance | null,
    isSVG: boolean,
    optimized: boolean = false
  ) {
    const c1 = n1 && n1.children
    const prevShapeFlag = n1 ? n1.shapeFlag : 0
    const c2 = n2.children

    // fast path
    const { patchFlag, shapeFlag } = n2
    if (patchFlag) {
      if (patchFlag & PatchFlags.KEYED) {
        // this could be either fully-keyed or mixed (some keyed some not)
        // presence of patchFlag means children are guaranteed to be arrays
        patchKeyedChildren(
          c1 as VNode[],
          c2 as VNodeChildren,
          container,
          anchor,
          parentComponent,
          isSVG,
          optimized
        )
        return
      } else if (patchFlag & PatchFlags.UNKEYED) {
        // unkeyed
        patchUnkeyedChildren(
          c1 as VNode[],
          c2 as VNodeChildren,
          container,
          anchor,
          parentComponent,
          isSVG,
          optimized
        )
        return
      }
    }

    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // text children fast path
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        unmountChildren(c1 as VNode[], parentComponent)
      }
      if (c2 !== c1) {
        hostSetElementText(container, c2 as string)
      }
    } else {
      if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
        hostSetElementText(container, '')
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          mountChildren(
            c2 as VNodeChildren,
            container,
            anchor,
            parentComponent,
            isSVG
          )
        }
      } else if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // two arrays, cannot assume anything, do full diff
          patchKeyedChildren(
            c1 as VNode[],
            c2 as VNodeChildren,
            container,
            anchor,
            parentComponent,
            isSVG,
            optimized
          )
        } else {
          // c2 is null in this case
          unmountChildren(c1 as VNode[], parentComponent, true)
        }
      }
    }
  }

  function patchUnkeyedChildren(
    c1: VNode[],
    c2: VNodeChildren,
    container: HostNode,
    anchor: HostNode,
    parentComponent: ComponentInstance | null,
    isSVG: boolean,
    optimized: boolean
  ) {
    c1 = c1 || EMPTY_ARR
    c2 = c2 || EMPTY_ARR
    const oldLength = c1.length
    const newLength = c2.length
    const commonLength = Math.min(oldLength, newLength)
    let i
    for (i = 0; i < commonLength; i++) {
      const nextChild = (c2[i] = normalizeVNode(c2[i]))
      patch(
        c1[i],
        nextChild,
        container,
        null,
        parentComponent,
        isSVG,
        optimized
      )
    }
    if (oldLength > newLength) {
      // remove old
      unmountChildren(c1, parentComponent, true, commonLength)
    } else {
      // mount new
      mountChildren(c2, container, anchor, parentComponent, isSVG, commonLength)
    }
  }

  // can be all-keyed or mixed
  function patchKeyedChildren(
    c1: VNode[],
    c2: VNodeChildren,
    container: HostNode,
    parentAnchor: HostNode,
    parentComponent: ComponentInstance | null,
    isSVG: boolean,
    optimized: boolean
  ) {
    let i = 0
    const l2 = c2.length
    let e1 = c1.length - 1 // prev ending index
    let e2 = l2 - 1 // next ending index

    // 1. sync from start
    // (a b) c
    // (a b) d e
    while (i <= e1 && i <= e2) {
      const n1 = c1[i]
      const n2 = (c2[i] = normalizeVNode(c2[i]))
      if (isSameType(n1, n2)) {
        patch(
          n1,
          n2,
          container,
          parentAnchor,
          parentComponent,
          isSVG,
          optimized
        )
      } else {
        break
      }
      i++
    }

    // 2. sync from end
    // a (b c)
    // d e (b c)
    while (i <= e1 && i <= e2) {
      const n1 = c1[e1]
      const n2 = (c2[e2] = normalizeVNode(c2[e2]))
      if (isSameType(n1, n2)) {
        patch(
          n1,
          n2,
          container,
          parentAnchor,
          parentComponent,
          isSVG,
          optimized
        )
      } else {
        break
      }
      e1--
      e2--
    }

    // 3. common sequence + mount
    // (a b)
    // (a b) c
    // i = 2, e1 = 1, e2 = 2
    // (a b)
    // c (a b)
    // i = 0, e1 = -1, e2 = 0
    if (i > e1) {
      if (i <= e2) {
        const nextPos = e2 + 1
        const anchor = nextPos < l2 ? (c2[nextPos] as VNode).el : parentAnchor
        while (i <= e2) {
          patch(
            null,
            (c2[i] = normalizeVNode(c2[i])),
            container,
            anchor,
            parentComponent,
            isSVG
          )
          i++
        }
      }
    }

    // 4. common sequence + unmount
    // (a b) c
    // (a b)
    // i = 2, e1 = 2, e2 = 1
    // a (b c)
    // (b c)
    // i = 0, e1 = 0, e2 = -1
    else if (i > e2) {
      while (i <= e1) {
        unmount(c1[i], parentComponent, true)
        i++
      }
    }

    // 5. unknown sequence
    // [i ... e1 + 1]: a b [c d e] f g
    // [i ... e2 + 1]: a b [e d c h] f g
    // i = 2, e1 = 4, e2 = 5
    else {
      const s1 = i // prev starting index
      const s2 = i // next starting index

      // 5.1 build key:index map for newChildren
      const keyToNewIndexMap: Map<any, number> = new Map()
      for (i = s2; i <= e2; i++) {
        const nextChild = (c2[i] = normalizeVNode(c2[i]))
        if (nextChild.key != null) {
          // TODO warn duplicate keys
          keyToNewIndexMap.set(nextChild.key, i)
        }
      }

      // 5.2 loop through old children left to be patched and try to patch
      // matching nodes & remove nodes that are no longer present
      let j
      let patched = 0
      const toBePatched = e2 - s2 + 1
      let moved = false
      // used to track whether any node has moved
      let maxNewIndexSoFar = 0
      // works as Map<newIndex, oldIndex>
      // Note that oldIndex is offset by +1
      // and oldIndex = 0 is a special value indicating the new node has
      // no corresponding old node.
      // used for determining longest stable subsequence
      const newIndexToOldIndexMap = []
      for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap.push(0)

      for (i = s1; i <= e1; i++) {
        const prevChild = c1[i]
        if (patched >= toBePatched) {
          // all new children have been patched so this can only be a removal
          unmount(prevChild, parentComponent, true)
          continue
        }
        let newIndex
        if (prevChild.key != null) {
          newIndex = keyToNewIndexMap.get(prevChild.key)
        } else {
          // key-less node, try to locate a key-less node of the same type
          for (j = s2; j <= e2; j++) {
            if (isSameType(prevChild, c2[j] as VNode)) {
              newIndex = j
              break
            }
          }
        }
        if (newIndex === undefined) {
          unmount(prevChild, parentComponent, true)
        } else {
          newIndexToOldIndexMap[newIndex - s2] = i + 1
          if (newIndex >= maxNewIndexSoFar) {
            maxNewIndexSoFar = newIndex
          } else {
            moved = true
          }
          patch(
            prevChild,
            c2[newIndex] as VNode,
            container,
            null,
            parentComponent,
            isSVG,
            optimized
          )
          patched++
        }
      }

      // 5.3 move and mount
      // generate longest stable subsequence only when nodes have moved
      const increasingNewIndexSequence = moved
        ? getSequence(newIndexToOldIndexMap)
        : EMPTY_ARR
      j = increasingNewIndexSequence.length - 1
      // looping backwards so that we can use last patched node as anchor
      for (i = toBePatched - 1; i >= 0; i--) {
        const nextIndex = s2 + i
        const nextChild = c2[nextIndex] as VNode
        const anchor =
          nextIndex + 1 < l2 ? (c2[nextIndex + 1] as VNode).el : parentAnchor
        if (newIndexToOldIndexMap[i] === 0) {
          // mount new
          patch(null, nextChild, container, anchor, parentComponent, isSVG)
        } else if (moved) {
          // move if:
          // There is no stable subsequence (e.g. a reverse)
          // OR current node is not among the stable sequence
          if (j < 0 || i !== increasingNewIndexSequence[j]) {
            move(nextChild, container, anchor)
          } else {
            j--
          }
        }
      }
    }
  }

  function move(vnode: VNode, container: HostNode, anchor: HostNode) {
    if (vnode.component !== null) {
      move(vnode.component.subTree, container, anchor)
      return
    }
    if (vnode.type === Fragment) {
      hostInsert(vnode.el, container, anchor)
      const children = vnode.children as VNode[]
      for (let i = 0; i < children.length; i++) {
        hostInsert(children[i].el, container, anchor)
      }
      hostInsert(vnode.anchor, container, anchor)
    } else {
      hostInsert(vnode.el, container, anchor)
    }
  }

  function unmount(
    vnode: VNode,
    parentComponent: ComponentInstance | null,
    doRemove?: boolean
  ) {
    // unset ref
    if (vnode.ref !== null && parentComponent !== null) {
      setRef(vnode.ref, null, parentComponent, null)
    }

    const instance = vnode.component
    if (instance != null) {
      unmountComponent(instance, doRemove)
      return
    }

    const shouldRemoveChildren = vnode.type === Fragment && doRemove
    if (vnode.dynamicChildren != null) {
      unmountChildren(
        vnode.dynamicChildren,
        parentComponent,
        shouldRemoveChildren
      )
    } else if (vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      unmountChildren(
        vnode.children as VNode[],
        parentComponent,
        shouldRemoveChildren
      )
    }

    if (doRemove) {
      hostRemove(vnode.el)
      if (vnode.anchor != null) hostRemove(vnode.anchor)
    }
  }

  function unmountComponent(instance: ComponentInstance, doRemove?: boolean) {
    const { bum, effects, update, subTree, um } = instance
    // beforeUnmount hook
    if (bum !== null) {
      invokeHooks(bum)
    }
    if (effects !== null) {
      for (let i = 0; i < effects.length; i++) {
        stop(effects[i])
      }
    }
    stop(update)
    unmount(subTree, instance, doRemove)
    // unmounted hook
    if (um !== null) {
      queuePostFlushCb(um)
    }
  }

  function unmountChildren(
    children: VNode[],
    parentComponent: ComponentInstance | null,
    doRemove?: boolean,
    start: number = 0
  ) {
    for (let i = start; i < children.length; i++) {
      unmount(children[i], parentComponent, doRemove)
    }
  }

  function getNextHostNode(vnode: VNode): HostNode {
    return vnode.component === null
      ? hostNextSibling(vnode.anchor || vnode.el)
      : getNextHostNode(vnode.component.subTree)
  }

  function setRef(
    ref: string | Function | Ref<any>,
    oldRef: string | Function | Ref<any> | null,
    parent: ComponentInstance,
    value: HostNode | ComponentInstance | null
  ) {
    const refs = parent.refs === EMPTY_OBJ ? (parent.refs = {}) : parent.refs
    const rawData = toRaw(parent.data)

    // unset old ref
    if (oldRef !== null && oldRef !== ref) {
      if (isString(oldRef)) {
        refs[oldRef] = null
        const oldSetupRef = rawData[oldRef]
        if (isRef(oldSetupRef)) {
          oldSetupRef.value = null
        }
      } else if (isRef(oldRef)) {
        oldRef.value = null
      }
    }

    if (isString(ref)) {
      const setupRef = rawData[ref]
      if (isRef(setupRef)) {
        setupRef.value = value
      }
      refs[ref] = value
    } else if (isRef(ref)) {
      ref.value = value
    } else {
      if (__DEV__ && !isFunction(ref)) {
        // TODO warn invalid ref type
      }
      ref(value, refs)
    }
  }

  return function render(vnode: VNode | null, dom: HostNode): VNode | null {
    if (vnode == null) {
      if (dom._vnode) {
        unmount(dom._vnode, null, true)
      }
    } else {
      patch(dom._vnode, vnode, dom)
    }
    flushPostFlushCbs()
    return (dom._vnode = vnode)
  }
}

// https://en.wikipedia.org/wiki/Longest_increasing_subsequence
function getSequence(arr: number[]): number[] {
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
