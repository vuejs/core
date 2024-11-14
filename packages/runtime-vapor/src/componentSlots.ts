import { type IfAny, isArray, isFunction } from '@vue/shared'
import {
  type EffectScope,
  effectScope,
  isReactive,
  shallowReactive,
  shallowRef,
} from '@vue/reactivity'
import {
  type ComponentInternalInstance,
  currentInstance,
  setCurrentInstance,
} from './component'
import { type Block, type Fragment, fragmentKey } from './apiRender'
import { firstEffect, renderEffect } from './renderEffect'
import {
  createComment,
  createTextNode,
  insert,
  normalizeBlock,
  remove,
} from './dom/element'
import type { NormalizedRawProps } from './componentProps'
import type { Data } from '@vue/runtime-shared'
import { mergeProps } from './dom/prop'

// TODO: SSR

export type Slot<T extends any = any> = (
  ...args: IfAny<T, any[], [T] | (T extends undefined ? [] : never)>
) => Block

export type StaticSlots = Record<string, Slot>
export type DynamicSlot = { name: string; fn: Slot }
export type DynamicSlotFn = () => DynamicSlot | DynamicSlot[] | undefined
export type NormalizedRawSlots = Array<StaticSlots | DynamicSlotFn>
export type RawSlots = NormalizedRawSlots | StaticSlots | null

export const isDynamicSlotFn = isFunction as (
  val: StaticSlots | DynamicSlotFn,
) => val is DynamicSlotFn

export function initSlots(
  instance: ComponentInternalInstance,
  rawSlots: RawSlots | null = null,
): void {
  if (!rawSlots) return
  if (!isArray(rawSlots)) rawSlots = [rawSlots]

  if (!rawSlots.some(slot => isDynamicSlotFn(slot))) {
    instance.slots = {}
    // with ctx
    const slots = rawSlots[0] as StaticSlots
    for (const name in slots) {
      registerSlot(name, slots[name])
    }
    return
  }

  instance.slots = shallowReactive({})
  const keys: Set<string>[] = []
  rawSlots.forEach((slots, index) => {
    const isDynamicSlot = isDynamicSlotFn(slots)
    if (isDynamicSlot) {
      firstEffect(instance, () => {
        const recordNames = keys[index] || (keys[index] = new Set())
        let dynamicSlot: ReturnType<DynamicSlotFn>
        if (isDynamicSlotFn(slots)) {
          dynamicSlot = slots()
          if (isArray(dynamicSlot)) {
            for (const slot of dynamicSlot) {
              registerSlot(slot.name, slot.fn, recordNames)
            }
          } else if (dynamicSlot) {
            registerSlot(dynamicSlot.name, dynamicSlot.fn, recordNames)
          }
        } else {
        }
        for (const name of recordNames) {
          if (
            !(isArray(dynamicSlot)
              ? dynamicSlot.some(s => s.name === name)
              : dynamicSlot && dynamicSlot.name === name)
          ) {
            recordNames.delete(name)
            delete instance.slots[name]
          }
        }
      })
    } else {
      for (const name in slots) {
        registerSlot(name, slots[name])
      }
    }
  })

  function registerSlot(name: string, fn: Slot, recordNames?: Set<string>) {
    instance.slots[name] = withCtx(fn)
    recordNames && recordNames.add(name)
  }

  function withCtx(fn: Slot): Slot {
    return (...args: any[]) => {
      const reset = setCurrentInstance(instance.parent!)
      try {
        return fn(...(args as any))
      } finally {
        reset()
      }
    }
  }
}

export function createSlot(
  name: string | (() => string),
  binds?: NormalizedRawProps,
  fallback?: Slot,
): Block {
  const { slots } = currentInstance!

  const slotBlock = shallowRef<Block>()
  let slotBranch: Slot | undefined
  let slotScope: EffectScope | undefined

  let fallbackBlock: Block | undefined
  let fallbackBranch: Slot | undefined
  let fallbackScope: EffectScope | undefined

  const normalizeBinds = binds && normalizeSlotProps(binds)

  const isDynamicName = isFunction(name)
  // fast path for static slots & without fallback
  if (!isDynamicName && !isReactive(slots) && !fallback) {
    if ((slotBranch = slots[name])) {
      return slotBranch(normalizeBinds)
    } else {
      return []
    }
  }

  const anchor = __DEV__ ? createComment('slot') : createTextNode()
  const fragment: Fragment = {
    nodes: [],
    anchor,
    [fragmentKey]: true,
  }

  // TODO lifecycle hooks
  renderEffect(() => {
    const parent = anchor.parentNode

    if (
      !slotBlock.value || // not initied
      fallbackScope || // in fallback slot
      isValidBlock(slotBlock.value) // slot block is valid
    ) {
      renderSlot(parent)
    } else {
      renderFallback(parent)
    }
  })

  return fragment

  function renderSlot(parent: ParentNode | null) {
    // from fallback to slot
    const fromFallback = fallbackScope
    if (fromFallback) {
      // clean fallback slot
      fallbackScope!.stop()
      remove(fallbackBlock!, parent!)
      fallbackScope = fallbackBlock = undefined
    }

    const slotName = isFunction(name) ? name() : name
    const branch = slots[slotName]!

    if (branch) {
      // init slot scope and block or switch branch
      if (!slotScope || slotBranch !== branch) {
        // clean previous slot
        if (slotScope && !fromFallback) {
          slotScope.stop()
          remove(slotBlock.value!, parent!)
        }

        slotBranch = branch
        slotScope = effectScope()
        slotBlock.value = slotScope.run(() => slotBranch!(normalizeBinds))
      }

      // if slot block is valid, render it
      if (slotBlock.value && isValidBlock(slotBlock.value)) {
        fragment.nodes = slotBlock.value
        parent && insert(slotBlock.value, parent, anchor)
      } else {
        renderFallback(parent)
      }
    } else {
      renderFallback(parent)
    }
  }

  function renderFallback(parent: ParentNode | null) {
    // if slot branch is initied, remove it from DOM, but keep the scope
    if (slotBranch) {
      remove(slotBlock.value!, parent!)
    }

    fallbackBranch ||= fallback
    if (fallbackBranch) {
      fallbackScope = effectScope()
      fragment.nodes = fallbackBlock = fallbackScope.run(() =>
        fallbackBranch!(normalizeBinds),
      )!
      parent && insert(fallbackBlock, parent, anchor)
    } else {
      fragment.nodes = []
    }
  }
}

function normalizeSlotProps(rawPropsList: NormalizedRawProps) {
  const { length } = rawPropsList
  const mergings = length > 1 ? shallowReactive<Data[]>([]) : undefined
  const result = shallowReactive<Data>({})

  for (let i = 0; i < length; i++) {
    const rawProps = rawPropsList[i]
    if (isFunction(rawProps)) {
      // dynamic props
      renderEffect(() => {
        const props = rawProps()
        if (mergings) {
          mergings[i] = props
        } else {
          setDynamicProps(props)
        }
      })
    } else {
      // static props
      const props = mergings
        ? (mergings[i] = shallowReactive<Data>({}))
        : result
      for (const key in rawProps) {
        const valueSource = rawProps[key]
        renderEffect(() => {
          props[key] = valueSource()
        })
      }
    }
  }

  if (mergings) {
    renderEffect(() => {
      setDynamicProps(mergeProps(...mergings))
    })
  }

  return result

  function setDynamicProps(props: Data) {
    const otherExistingKeys = new Set(Object.keys(result))
    for (const key in props) {
      result[key] = props[key]
      otherExistingKeys.delete(key)
    }
    // delete other stale props
    for (const key of otherExistingKeys) {
      delete result[key]
    }
  }
}

function isValidBlock(block: Block) {
  return (
    normalizeBlock(block).filter(node => !(node instanceof Comment)).length > 0
  )
}
