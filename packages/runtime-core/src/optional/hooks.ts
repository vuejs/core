import { ComponentInstance, FunctionalComponent } from '../component'
import { mergeLifecycleHooks, Data } from '../componentOptions'
import { VNode, Slots } from '../vdom'
import { observable } from '@vue/observer'

type RawEffect = () => (() => void) | void

type Effect = RawEffect & {
  current?: RawEffect | null | void
}

type EffectRecord = {
  effect: Effect
  cleanup: Effect
  deps: any[] | void
}

type HookState = {
  state: any
  effects: EffectRecord[]
}

let currentInstance: ComponentInstance | null = null
let isMounting: boolean = false
let callIndex: number = 0

const hooksState = new WeakMap<ComponentInstance, HookState>()

export function setCurrentInstance(instance: ComponentInstance) {
  currentInstance = instance
  isMounting = !currentInstance._mounted
  callIndex = 0
}

export function unsetCurrentInstance() {
  currentInstance = null
}

export function useState(initial: any) {
  if (!currentInstance) {
    throw new Error(
      `useState must be called in a function passed to withHooks.`
    )
  }
  const id = ++callIndex
  const { state } = hooksState.get(currentInstance) as HookState
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
      const { current } = effect
      if (current) {
        cleanup.current = current()
        effect.current = null
      }
    }
    effect.current = rawEffect
    ;(hooksState.get(currentInstance) as HookState).effects[id] = {
      effect,
      cleanup,
      deps
    }

    injectEffect(currentInstance, 'mounted', effect)
    injectEffect(currentInstance, 'unmounted', cleanup)
    injectEffect(currentInstance, 'updated', effect)
  } else {
    const record = (hooksState.get(currentInstance) as HookState).effects[id]
    const { effect, cleanup, deps: prevDeps = [] } = record
    record.deps = deps
    if (!deps || deps.some((d, i) => d !== prevDeps[i])) {
      cleanup()
      effect.current = rawEffect
    }
  }
}

function injectEffect(
  instance: ComponentInstance,
  key: string,
  effect: Effect
) {
  const existing = instance.$options[key]
  ;(instance.$options as any)[key] = existing
    ? mergeLifecycleHooks(existing, effect)
    : effect
}

export function withHooks<T extends FunctionalComponent>(render: T): T {
  return {
    displayName: render.name,
    created() {
      hooksState.set(this._self, {
        state: observable({}),
        effects: []
      })
    },
    render(props: Data, slots: Slots, attrs: Data, parentVNode: VNode) {
      setCurrentInstance(this._self)
      const ret = render(props, slots, attrs, parentVNode)
      unsetCurrentInstance()
      return ret
    }
  } as any
}
