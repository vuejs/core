import {
  ComponentInternalInstance,
  ComponentOptions,
  RenderFunction
} from './component'
import { queueJob, queuePostFlushCb } from './scheduler'

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
if (__BUNDLER__ && __DEV__) {
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

interface HMRRecord {
  comp: ComponentOptions
  instances: Set<ComponentInternalInstance>
}

const map: Map<string, HMRRecord> = new Map()

export function registerHMR(instance: ComponentInternalInstance) {
  map.get(instance.type.__hmrId!)!.instances.add(instance)
}

export function unregisterHMR(instance: ComponentInternalInstance) {
  map.get(instance.type.__hmrId!)!.instances.delete(instance)
}

function createRecord(id: string, comp: ComponentOptions): boolean {
  if (map.has(id)) {
    return false
  }
  map.set(id, {
    comp,
    instances: new Set()
  })
  return true
}

function rerender(id: string, newRender?: RenderFunction) {
  // Array.from creates a snapshot which avoids the set being mutated during
  // updates
  Array.from(map.get(id)!.instances).forEach(instance => {
    if (newRender) {
      instance.render = newRender
    }
    instance.renderCache = []
    // this flag forces child components with slot content to update
    instance.renderUpdated = true
    instance.update()
    instance.renderUpdated = false
  })
}

function reload(id: string, newComp: ComponentOptions) {
  const record = map.get(id)!
  // 1. Update existing comp definition to match new one
  const comp = record.comp
  Object.assign(comp, newComp)
  for (const key in comp) {
    if (!(key in newComp)) {
      delete (comp as any)[key]
    }
  }
  // 2. Mark component dirty. This forces the renderer to replace the component
  // on patch.
  comp.__hmrUpdated = true
  // Array.from creates a snapshot which avoids the set being mutated during
  // updates
  Array.from(record.instances).forEach(instance => {
    if (instance.parent) {
      // 3. Force the parent instance to re-render. This will cause all updated
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
  // 4. Make sure to unmark the component after the reload.
  queuePostFlushCb(() => {
    comp.__hmrUpdated = false
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
