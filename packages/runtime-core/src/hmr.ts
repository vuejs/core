/* eslint-disable no-restricted-globals */
import {
  type ClassComponent,
  type ComponentInternalInstance,
  type ComponentOptions,
  type ConcreteComponent,
  type GenericComponentInstance,
  isClassComponent,
} from './component'
import { nextTick, queueJob, queuePostFlushCb } from './scheduler'
import { extend, getGlobalThis } from '@vue/shared'

type HMRComponent = ComponentOptions | ClassComponent

export let isHmrUpdating = false

export const hmrDirtyComponents: Map<
  ConcreteComponent,
  Set<GenericComponentInstance>
> = new Map<ConcreteComponent, Set<GenericComponentInstance>>()

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
if (__DEV__) {
  getGlobalThis().__VUE_HMR_RUNTIME__ = {
    createRecord: tryWrap(createRecord),
    rerender: tryWrap(rerender),
    reload: tryWrap(reload),
  } as HMRRuntime
}

const map: Map<
  string,
  {
    // the initial component definition is recorded on import - this allows us
    // to apply hot updates to the component even when there are no actively
    // rendered instance.
    initialDef: ComponentOptions
    instances: Set<GenericComponentInstance>
  }
> = new Map()

export function registerHMR(instance: GenericComponentInstance): void {
  const id = instance.type.__hmrId!
  let record = map.get(id)
  if (!record) {
    createRecord(id, instance.type as HMRComponent)
    record = map.get(id)!
  }
  record.instances.add(instance)
}

export function unregisterHMR(instance: GenericComponentInstance): void {
  map.get(instance.type.__hmrId!)!.instances.delete(instance)
}

function createRecord(id: string, initialDef: HMRComponent): boolean {
  if (map.has(id)) {
    return false
  }
  map.set(id, {
    initialDef: normalizeClassComponent(initialDef),
    instances: new Set(),
  })
  return true
}

function normalizeClassComponent(component: HMRComponent): ComponentOptions {
  return isClassComponent(component) ? component.__vccOpts : component
}

function rerender(id: string, newRender?: Function): void {
  const record = map.get(id)
  if (!record) {
    return
  }

  // update initial record (for not-yet-rendered component)
  record.initialDef.render = newRender

  // Create a snapshot which avoids the set being mutated during updates
  ;[...record.instances].forEach(instance => {
    if (newRender) {
      instance.render = newRender
      normalizeClassComponent(instance.type as HMRComponent).render = newRender
    }
    // this flag forces child components with slot content to update
    isHmrUpdating = true
    if (instance.vapor) {
      instance.hmrRerender!()
    } else {
      const i = instance as ComponentInternalInstance
      i.renderCache = []
      i.effect.run()
    }
    nextTick(() => {
      isHmrUpdating = false
    })
  })
}

function reload(id: string, newComp: HMRComponent): void {
  const record = map.get(id)
  if (!record) return

  newComp = normalizeClassComponent(newComp)
  // update initial def (for not-yet-rendered components)
  updateComponentDef(record.initialDef, newComp)

  // create a snapshot which avoids the set being mutated during updates
  const instances = [...record.instances]

  if (newComp.vapor) {
    for (const instance of instances) {
      instance.hmrReload!(newComp)
    }
  } else {
    for (const instance of instances as ComponentInternalInstance[]) {
      const oldComp = normalizeClassComponent(instance.type as HMRComponent)

      let dirtyInstances = hmrDirtyComponents.get(oldComp)
      if (!dirtyInstances) {
        // 1. Update existing comp definition to match new one
        if (oldComp !== record.initialDef) {
          updateComponentDef(oldComp, newComp)
        }
        // 2. mark definition dirty. This forces the renderer to replace the
        // component on patch.
        hmrDirtyComponents.set(oldComp, (dirtyInstances = new Set()))
      }
      dirtyInstances.add(instance)

      // 3. invalidate options resolution cache
      instance.appContext.propsCache.delete(instance.type as any)
      instance.appContext.emitsCache.delete(instance.type as any)
      instance.appContext.optionsCache.delete(instance.type as any)

      // 4. actually update
      if (instance.ceReload) {
        // custom element
        dirtyInstances.add(instance)
        instance.ceReload((newComp as any).styles)
        dirtyInstances.delete(instance)
      } else if (instance.parent) {
        // 4. Force the parent instance to re-render. This will cause all updated
        // components to be unmounted and re-mounted. Queue the update so that we
        // don't end up forcing the same parent to re-render multiple times.
        queueJob(() => {
          isHmrUpdating = true
          const parent = instance.parent!
          if (parent.vapor) {
            parent.hmrRerender!()
          } else {
            ;(parent as ComponentInternalInstance).effect.run()
          }
          nextTick(() => {
            isHmrUpdating = false
          })
          // #6930, #11248 avoid infinite recursion
          dirtyInstances.delete(instance)
        })
      } else if (instance.appContext.reload) {
        // root instance mounted via createApp() has a reload method
        instance.appContext.reload()
      } else if (typeof window !== 'undefined') {
        // root instance inside tree created via raw render(). Force reload.
        window.location.reload()
      } else {
        console.warn(
          '[HMR] Root or manually mounted instance modified. Full reload required.',
        )
      }

      // update custom element child style
      if (instance.root.ce && instance !== instance.root) {
        instance.root.ce._removeChildStyle(oldComp)
      }
    }
  }
  // 5. make sure to cleanup dirty hmr components after update
  queuePostFlushCb(() => {
    hmrDirtyComponents.clear()
  })
}

function updateComponentDef(
  oldComp: ComponentOptions,
  newComp: ComponentOptions,
) {
  extend(oldComp, newComp)
  for (const key in oldComp) {
    if (key !== '__file' && !(key in newComp)) {
      delete oldComp[key]
    }
  }
}

function tryWrap(fn: (id: string, arg: any) => any): Function {
  return (id: string, arg: any) => {
    try {
      return fn(id, arg)
    } catch (e: any) {
      console.error(e)
      console.warn(
        `[HMR] Something went wrong during Vue component hot-reload. ` +
          `Full reload required.`,
      )
    }
  }
}
