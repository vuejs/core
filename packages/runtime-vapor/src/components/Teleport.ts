import {
  TeleportEndKey,
  type TeleportProps,
  isTeleportDeferred,
  isTeleportDisabled,
  queuePostFlushCb,
  resolveTarget,
  warn,
} from '@vue/runtime-dom'
import {
  type Block,
  type BlockFn,
  VaporFragment,
  insert,
  remove,
} from '../block'
import { createComment, createTextNode, querySelector } from '../dom/node'
import type { LooseRawProps, LooseRawSlots } from '../component'
import { rawPropsProxyHandlers } from '../componentProps'
import { renderEffect } from '../renderEffect'
import { extend } from '@vue/shared'

export const VaporTeleportImpl = {
  name: 'VaporTeleport',
  __isTeleport: true,
  __vapor: true,

  process(props: LooseRawProps, slots: LooseRawSlots): TeleportFragment {
    const frag = __DEV__
      ? new TeleportFragment('teleport')
      : new TeleportFragment()

    const resolvedProps = new Proxy(
      props,
      rawPropsProxyHandlers,
    ) as any as TeleportProps

    renderEffect(() => {
      const children = slots.default && (slots.default as BlockFn)()
      // access the props to trigger tracking
      frag.update(extend({}, resolvedProps), children)
    })

    return frag
  },
}

export class TeleportFragment extends VaporFragment {
  anchor: Node
  targetStart?: Node | null
  mainAnchor?: Node
  placeholder?: Node
  currentParent?: ParentNode | null

  constructor(anchorLabel?: string) {
    super([])
    this.anchor =
      __DEV__ && anchorLabel ? createComment(anchorLabel) : createTextNode()
  }

  update(props: TeleportProps, children: Block): void {
    // teardown previous
    if (this.currentParent && this.nodes) {
      remove(this.nodes, this.currentParent)
    }

    this.nodes = children
    const disabled = isTeleportDisabled(props)
    const parent = this.anchor.parentNode

    const mount = (parent: ParentNode, anchor: Node | null) => {
      insert(this.nodes, (this.currentParent = parent), anchor)
    }

    const mountToTarget = () => {
      const target = (this.target = resolveTarget(props, querySelector))
      if (target) {
        if (
          // initial mount
          !this.targetStart ||
          // target changed
          this.targetStart.parentNode !== target
        ) {
          ;[this.targetAnchor, this.targetStart] = prepareAnchor(target)
        }

        mount(target, this.targetAnchor!)
      } else if (__DEV__) {
        warn(
          `Invalid Teleport target on ${this.targetStart ? 'update' : 'mount'}:`,
          target,
          `(${typeof target})`,
        )
      }
    }

    if (parent && disabled) {
      if (!this.mainAnchor) {
        this.mainAnchor = __DEV__
          ? createComment('teleport end')
          : createTextNode()
      }
      if (!this.placeholder) {
        this.placeholder = __DEV__
          ? createComment('teleport start')
          : createTextNode()
      }
      if (!this.mainAnchor.isConnected) {
        insert(this.placeholder, parent, this.anchor)
        insert(this.mainAnchor, parent, this.anchor)
      }

      mount(parent, this.mainAnchor)
    }

    if (!disabled) {
      if (isTeleportDeferred(props)) {
        queuePostFlushCb(mountToTarget)
      } else {
        mountToTarget()
      }
    }
  }

  remove = (parent: ParentNode | undefined): void => {
    // remove nodes
    remove(this.nodes, this.currentParent || parent)

    // remove anchors
    if (this.targetStart) {
      let parentNode = this.targetStart.parentNode!
      remove(this.targetStart!, parentNode)
      remove(this.targetAnchor!, parentNode)
    }
    if (this.placeholder) {
      remove(this.placeholder!, parent)
      remove(this.mainAnchor!, parent)
    }
  }

  hydrate(): void {
    // TODO
  }
}

function prepareAnchor(target: ParentNode | null) {
  const targetStart = createTextNode('')
  const targetAnchor = createTextNode('')

  // attach a special property, so we can skip teleported content in
  // renderer's nextSibling search
  // @ts-expect-error
  targetStart[TeleportEndKey] = targetAnchor

  if (target) {
    insert(targetStart, target)
    insert(targetAnchor, target)
  }

  return [targetAnchor, targetStart]
}
