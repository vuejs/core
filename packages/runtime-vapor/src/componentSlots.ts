import { type IfAny, isArray, isFunction } from '@vue/shared'
import {
  type EffectScope,
  effectScope,
  isReactive,
  shallowReactive,
} from '@vue/reactivity'
import {
  type ComponentInternalInstance,
  currentInstance,
  setCurrentInstance,
} from './component'
import { type Block, type Fragment, fragmentKey } from './apiRender'
import { firstEffect, renderEffect } from './renderEffect'
import { createComment, createTextNode, insert, remove } from './dom/element'
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
  fallback?: () => Block,
): Block {
  let block: Block | undefined
  let branch: Slot | undefined
  let oldBranch: Slot | undefined
  let parent: ParentNode | undefined | null
  let scope: EffectScope | undefined
  const isDynamicName = isFunction(name)
  const instance = currentInstance!
  const { slots } = instance

  // When not using dynamic slots, simplify the process to improve performance
  if (!isDynamicName && !isReactive(slots)) {
    if ((branch = withProps(slots[name]) || fallback)) {
      return branch(binds)
    } else {
      return []
    }
  }

  const getSlot = isDynamicName ? () => slots[name()] : () => slots[name]
  const anchor = __DEV__ ? createComment('slot') : createTextNode()
  const fragment: Fragment = {
    nodes: [],
    anchor,
    [fragmentKey]: true,
  }

  // TODO lifecycle hooks
  renderEffect(() => {
    if ((branch = withProps(getSlot()) || fallback) !== oldBranch) {
      parent ||= anchor.parentNode
      if (block) {
        scope!.stop()
        remove(block, parent!)
      }
      if ((oldBranch = branch)) {
        scope = effectScope()
        fragment.nodes = block = scope.run(() => branch!(binds))!
        parent && insert(block, parent, anchor)
      } else {
        scope = block = undefined
        fragment.nodes = []
      }
    }
  })

  return fragment

  function withProps<T extends (p: any) => any>(fn?: T) {
    if (fn)
      return (binds?: NormalizedRawProps): ReturnType<T> =>
        fn(binds && normalizeSlotProps(binds))
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
