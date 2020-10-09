/* eslint-disable no-restricted-globals */
import {
  ConcreteComponent,
  ComponentInternalInstance,
  ComponentOptions,
  InternalRenderFunction,
  ClassComponent,
  isClassComponent
} from './component'
import { queueJob, queuePostFlushCb } from './scheduler'
import { extend } from '@vue/shared'

export let isHmrUpdating = false

export const hmrDirtyComponents = new Set<ConcreteComponent>()

export interface HMRRuntime {
  createRecord: typeof createRecord
  rerender: typeof rerender
  reload: typeof reload
}

// Expose the HMR runtime on the global object
// This makes it entirely tree-shakable without polluting the exports and makes
// it easier to be used in toolings like vue-loader
// Note: for a component to be eligible for HMR it also needs the __hmrId option
// to be set so that its instances can be registered / removed.
if (__DEV__ && (__BROWSER__ || __TEST__)) {
  const globalObject: any =
    typeof global !== 'undefined'
      ? global
      : typeof self !== 'undefined'
        ? self
        : typeof window !== 'undefined'
          ? window
          : {}

  globalObject.__VUE_HMR_RUNTIME__ = {
    createRecord: tryWrap(createRecord),
    rerender: tryWrap(rerender),
    reload: tryWrap(reload)
  } as HMRRuntime
}

type HMRRecord = Set<ComponentInternalInstance>

const map: Map<string, HMRRecord> = new Map()

export function registerHMR(instance: ComponentInternalInstance) {
  const id = instance.type.__hmrId!
  let record = map.get(id)
  if (!record) {
    createRecord(id)
    record = map.get(id)!
  }
  record.add(instance)
}

export function unregisterHMR(instance: ComponentInternalInstance) {
  map.get(instance.type.__hmrId!)!.delete(instance)
}

function createRecord(id: string): boolean {
  if (map.has(id)) {
    return false
  }
  map.set(id, new Set())
  return true
}

function rerender(id: string, newRender?: Function) {
  const record = map.get(id)
  if (!record) return
  // Array.from creates a snapshot which avoids the set being mutated during
  // updates
  Array.from(record).forEach(instance => {
    if (newRender) {
      instance.render = newRender as InternalRenderFunction
    }
    instance.renderCache = []
    // this flag forces child components with slot content to update
    isHmrUpdating = true
    instance.update()
    isHmrUpdating = false
  })
}

function reload(id: string, newComp: ComponentOptions | ClassComponent) {
  const record = map.get(id)
  if (!record) return
  // Array.from creates a snapshot which avoids the set being mutated during
  // updates
  Array.from(record).forEach(instance => {
    const comp = instance.type
    if (!hmrDirtyComponents.has(comp)) {
      // 1. Update existing comp definition to match new one
      newComp = isClassComponent(newComp) ? newComp.__vccOpts : newComp
      extend(comp, newComp)
      for (const key in comp) {
        if (!(key in newComp)) {
          delete (comp as any)[key]
        }
      }
      // 2. Mark component dirty. This forces the renderer to replace the component
      // on patch.
      hmrDirtyComponents.add(comp)
      // 3. Make sure to unmark the component after the reload.
      queuePostFlushCb(() => {
        hmrDirtyComponents.delete(comp)
      })
    }

    if (instance.parent) {
      // 4. Force the parent instance to re-render. This will cause all updated
      // components to be unmounted and re-mounted. Queue the update so that we
      // don't end up forcing the same parent to re-render multiple times.
      queueJob(instance.parent.update)
    } else if (instance.appContext.reload) {
      // root instance mounted via createApp() has a reload method
      instance.appContext.reload()
    } else if (typeof window !== 'undefined') {
      // root instance inside tree created via raw render(). Force reload.
      window.location.reload()
    } else {
      console.warn(
        '[HMR] Root or manually mounted instance modified. Full reload required.'
      )
    }
  })
}

function tryWrap(fn: (id: string, arg: any) => any): Function {
  return (id: string, arg: any) => {
    try {
      return fn(id, arg)
    } catch (e) {
      console.error(e)
      console.warn(
        `[HMR] Something went wrong during Vue component hot-reload. ` +
          `Full reload required.`
      )
    }
  }
}
