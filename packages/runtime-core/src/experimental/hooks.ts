import { ComponentInstance, FunctionalComponent, Component } from '../component'
import { mergeLifecycleHooks, Data, WatchOptions } from '../componentOptions'
import { VNode, Slots } from '../vdom'
import { observable, computed } from '@vue/observer'
import { setupWatcher } from '../componentWatch'

type RawEffect = () => (() => void) | void

type Effect = RawEffect & {
  current?: RawEffect | null | void
}

type EffectRecord = {
  effect: Effect
  cleanup: Effect
  deps: any[] | void
}

type Ref<T> = { current: T }

type HookState = {
  state: any
  effects: Record<number, EffectRecord>
  refs: Record<number, Ref<any>>
}

let currentInstance: ComponentInstance | null = null
let isMounting: boolean = false
let callIndex: number = 0

const hooksStateMap = new WeakMap<ComponentInstance, HookState>()

export function setCurrentInstance(instance: ComponentInstance) {
  currentInstance = instance
  isMounting = !currentInstance._mounted
  callIndex = 0
}

export function unsetCurrentInstance() {
  currentInstance = null
}

function ensureCurrentInstance() {
  if (!currentInstance) {
    throw new Error(
      `invalid hooks call` +
        (__DEV__
          ? `. Hooks can only be called in one of the following: ` +
            `render(), hooks(), or withHooks().`
          : ``)
    )
  }
}

function getCurrentHookState(): HookState {
  ensureCurrentInstance()
  let hookState = hooksStateMap.get(currentInstance as ComponentInstance)
  if (!hookState) {
    hookState = {
      state: observable({}),
      effects: {},
      refs: {}
    }
    hooksStateMap.set(currentInstance as ComponentInstance, hookState)
  }
  return hookState
}

// React compatible hooks ------------------------------------------------------

export function useState<T>(initial: T): [T, (newValue: T) => void] {
  const id = ++callIndex
  const { state } = getCurrentHookState()
  const set = (newValue: any) => {
    state[id] = newValue
  }
  if (isMounting) {
    set(initial)
  }
  return [state[id], set]
}

export function useEffect(rawEffect: Effect, deps?: any[]) {
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
    getCurrentHookState().effects[id] = {
      effect,
      cleanup,
      deps
    }

    injectEffect(currentInstance as ComponentInstance, 'mounted', effect)
    injectEffect(currentInstance as ComponentInstance, 'unmounted', cleanup)
    if (!deps || deps.length !== 0) {
      injectEffect(currentInstance as ComponentInstance, 'updated', effect)
    }
  } else {
    const record = getCurrentHookState().effects[id]
    const { effect, cleanup, deps: prevDeps = [] } = record
    record.deps = deps
    if (!deps || hasDepsChanged(deps, prevDeps)) {
      cleanup()
      effect.current = rawEffect
    }
  }
}

function hasDepsChanged(deps: any[], prevDeps: any[]): boolean {
  if (deps.length !== prevDeps.length) {
    return true
  }
  for (let i = 0; i < deps.length; i++) {
    if (deps[i] !== prevDeps[i]) {
      return true
    }
  }
  return false
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

export function useRef<T>(initial?: T): Ref<T> {
  const id = ++callIndex
  const { refs } = getCurrentHookState()
  return isMounting ? (refs[id] = { current: initial }) : refs[id]
}

// Vue API hooks ---------------------------------------------------------------

export function useData<T>(initial: T): T {
  const id = ++callIndex
  const { state } = getCurrentHookState()
  if (isMounting) {
    state[id] = initial
  }
  return state[id]
}

export function useMounted(fn: () => void) {
  useEffect(fn, [])
}

export function useUnmounted(fn: () => void) {
  useEffect(() => fn, [])
}

export function useUpdated(fn: () => void, deps?: any[]) {
  const isMount = useRef(true)
  useEffect(() => {
    if (isMount.current) {
      isMount.current = false
    } else {
      return fn()
    }
  }, deps)
}

export function useWatch<T>(
  getter: () => T,
  cb: (val: T, oldVal: T) => void,
  options?: WatchOptions
) {
  ensureCurrentInstance()
  if (isMounting) {
    setupWatcher(currentInstance as ComponentInstance, getter, cb, options)
  }
}

export function useComputed<T>(getter: () => T): T {
  ensureCurrentInstance()
  const id = `__hooksComputed${++callIndex}`
  const instance = currentInstance as ComponentInstance
  const handles = instance._computedGetters || (instance._computedGetters = {})
  if (isMounting) {
    handles[id] = computed(getter)
  }
  return handles[id]()
}

export function withHooks(render: FunctionalComponent): new () => Component {
  return class ComponentWithHooks extends Component {
    static displayName = render.name
    render(props: Data, slots: Slots, attrs: Data, parentVNode: VNode) {
      setCurrentInstance((this as any)._self)
      const ret = render(props, slots, attrs, parentVNode)
      unsetCurrentInstance()
      return ret
    }
  }
}
