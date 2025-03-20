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

export const VaporTeleportImpl = {
  name: 'VaporTeleport',
  __isTeleport: true,
  __vapor: true,

  process(props: LooseRawProps, slots: LooseRawSlots): TeleportFragment {
    const children = slots.default && (slots.default as BlockFn)()
    const frag = __DEV__
      ? new TeleportFragment('teleport')
      : new TeleportFragment()

    const resolvedProps = new Proxy(
      props,
      rawPropsProxyHandlers,
    ) as any as TeleportProps

    renderEffect(() => frag.update(resolvedProps, children))

    frag.remove = parent => {
      const {
        nodes,
        target,
        cachedTargetAnchor,
        targetStart,
        placeholder,
        mainAnchor,
      } = frag

      remove(nodes, target || parent)

      // remove anchors
      if (targetStart) {
        let parentNode = targetStart.parentNode!
        remove(targetStart!, parentNode)
        remove(cachedTargetAnchor!, parentNode)
      }
      if (placeholder && placeholder.isConnected) {
        remove(placeholder!, parent)
        remove(mainAnchor!, parent)
      }
    }

    return frag
  },
}

export class TeleportFragment extends VaporFragment {
  anchor: Node
  target?: ParentNode | null
  targetStart?: Node | null
  targetAnchor?: Node | null
  cachedTargetAnchor?: Node
  mainAnchor?: Node
  placeholder?: Node

  constructor(anchorLabel?: string) {
    super([])
    this.anchor =
      __DEV__ && anchorLabel ? createComment(anchorLabel) : createTextNode()
  }

  update(props: TeleportProps, children: Block): void {
    this.nodes = children
    const parent = this.anchor.parentNode

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
    if (parent) {
      insert(this.placeholder, parent, this.anchor)
      insert(this.mainAnchor, parent, this.anchor)
    }

    const disabled = isTeleportDisabled(props)
    if (disabled) {
      this.target = this.anchor.parentNode
      this.targetAnchor = parent ? this.mainAnchor : null
    } else {
      const target = (this.target = resolveTarget(
        props,
        querySelector,
      ) as ParentNode)
      if (target) {
        if (
          // initial mount
          !this.targetStart ||
          // target changed
          this.targetStart.parentNode !== target
        ) {
          ;[this.targetAnchor, this.targetStart] = prepareAnchor(target)
          this.cachedTargetAnchor = this.targetAnchor
        } else {
          // re-mount or target not changed, use cached target anchor
          this.targetAnchor = this.cachedTargetAnchor
        }
      } else if (__DEV__) {
        warn('Invalid Teleport target on mount:', target, `(${typeof target})`)
      }
    }

    const mountToTarget = () => {
      insert(this.nodes, this.target!, this.targetAnchor)
    }

    if (parent) {
      if (isTeleportDeferred(props)) {
        queuePostFlushCb(mountToTarget)
      } else {
        mountToTarget()
      }
    }
  }

  hydrate(): void {
    // TODO
  }
}

function prepareAnchor(target: ParentNode | null) {
  const targetStart = createTextNode('targetStart')
  const targetAnchor = createTextNode('targetAnchor')

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
