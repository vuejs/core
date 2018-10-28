import { ComponentInstance, APIMethods } from '../component'
import { mergeLifecycleHooks, Data } from '../componentOptions'
import { VNode, Slots } from '../vdom'
import { observable } from '@vue/observer'

type RawEffect = () => (() => void) | void

type Effect = RawEffect & {
  current?: RawEffect | null | void
}

type EffectRecord = {
  effect: Effect
  deps: any[] | void
}

type ComponentInstanceWithHook = ComponentInstance & {
  _state: Record<number, any>
  _effects: EffectRecord[]
}

let currentInstance: ComponentInstanceWithHook | null = null
let isMounting: boolean = false
let callIndex: number = 0

export function useState(initial: any) {
  if (!currentInstance) {
    throw new Error(
      `useState must be called in a function passed to withHooks.`
    )
  }
  const id = ++callIndex
  const state = currentInstance._state
  const set = (newValue: any) => {
    state[id] = newValue
  }
  if (isMounting) {
    set(initial)
  }
  return [state[id], set]
}

export function useEffect(rawEffect: Effect, deps?: any[]) {
  if (!currentInstance) {
    throw new Error(
      `useEffect must be called in a function passed to withHooks.`
    )
  }
  const id = ++callIndex
  if (isMounting) {
    const cleanup: Effect = () => {
      const { current } = cleanup
      if (current) {
        current()
        cleanup.current = null
      }
    }
    const effect: Effect = () => {
      cleanup()
      const { current } = effect
      if (current) {
        effect.current = current()
      }
    }
    effect.current = rawEffect

    currentInstance._effects[id] = {
      effect,
      deps
    }

    injectEffect(currentInstance, 'mounted', effect)
    injectEffect(currentInstance, 'unmounted', cleanup)
    if (!deps) {
      injectEffect(currentInstance, 'updated', effect)
    }
  } else {
    const { effect, deps: prevDeps = [] } = currentInstance._effects[id]
    if (!deps || deps.some((d, i) => d !== prevDeps[i])) {
      effect.current = rawEffect
    } else {
      effect.current = null
    }
  }
}

function injectEffect(
  instance: ComponentInstanceWithHook,
  key: string,
  effect: Effect
) {
  const existing = instance.$options[key]
  ;(instance.$options as any)[key] = existing
    ? mergeLifecycleHooks(existing, effect)
    : effect
}

export function withHooks<T extends APIMethods['render']>(render: T): T {
  return {
    displayName: render.name,
    created() {
      const { _self } = this
      _self._state = observable({})
      _self._effects = []
    },
    render(props: Data, slots: Slots, attrs: Data, parentVNode: VNode) {
      const { _self } = this
      callIndex = 0
      currentInstance = _self
      isMounting = !_self._mounted
      const ret = render(props, slots, attrs, parentVNode)
      currentInstance = null
      return ret
    }
  } as any
}
