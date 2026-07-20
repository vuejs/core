/* oxlint-disable no-restricted-globals */
import { EffectFlags } from '@vue/reactivity'
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

export const setHmrUpdating = (v: boolean): boolean => {
  try {
    return isHmrUpdating
  } finally {
    isHmrUpdating = v
  }
}

export const hmrDirtyComponents: Map<
  ConcreteComponent,
  Set<GenericComponentInstance>
> = new Map<ConcreteComponent, Set<GenericComponentInstance>>()

// During HMR reload, `updateComponentDef` mutates the old component definition
// with the new one's properties (including `__vapor`). This causes issues when
// a component switches between vapor and vdom modes, because the renderer still
// holds references to the old VNodes whose `type` now has an incorrect `__vapor`
// value. This Map tracks the original `__vapor` state of dirty components so
// that operations like unmount/move/getNextHostNode can use the correct mode.
export const hmrDirtyComponentsMode: Map<ConcreteComponent, boolean> = new Map<
  ConcreteComponent,
  boolean
>()

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

function hasDirtyAncestor(
  instance: GenericComponentInstance,
  dirtyInstances: Set<GenericComponentInstance>,
): boolean {
  let parent = instance.parent
  while (parent) {
    if (dirtyInstances.has(parent)) {
      return true
    }
    parent = parent.parent
  }
  return false
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
      if (!instance.isUnmounted) instance.hmrRerender!()
    } else {
      const i = instance as ComponentInternalInstance
      // #13771 don't update if the job is already disposed
      if (!(i.effect.flags! & EffectFlags.STOP)) {
        i.renderCache = []
        i.effect.run()
      }
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
  const isVapor = record.initialDef.__vapor
  // update initial def (for not-yet-rendered components)
  updateComponentDef(record.initialDef, newComp)

  // create a snapshot which avoids the set being mutated during updates
  const instances = [...record.instances]

  if (
    isVapor &&
    newComp.__vapor &&
    // VDOM parents need the VDOM HMR path to remount dirty Vapor children.
    !instances.some(instance => instance.parent && !instance.parent.vapor) &&
    !instances.some(i => i.ceReload)
  ) {
    // For multiple instances with the same __hmrId, remove styles first before reload
    // to avoid the second instance's style removal deleting the first instance's
    // newly added styles (since hmrReload is synchronous)
    for (const instance of instances) {
      // update custom element child style
      if (instance.root && instance.root.ce && instance !== instance.root) {
        instance.root.ce._removeChildStyle(instance.type)
      }
    }
    const dirtyInstances = new Set(instances)
    const rerenderedParents = new Set<GenericComponentInstance>()
    for (const instance of instances) {
      const parent = instance.parent
      if (parent) {
        // A dirty ancestor will recreate this child. Otherwise, each parent
        // only needs one rerender for this HMR record.
        if (
          !hasDirtyAncestor(instance, dirtyInstances) &&
          !rerenderedParents.has(parent)
        ) {
          rerenderedParents.add(parent)
          parent.hmrRerender!()
        }
      } else {
        instance.hmrReload!(newComp)
      }
    }
  } else {
    const parentUpdates = new Map<
      GenericComponentInstance,
      [GenericComponentInstance, Set<GenericComponentInstance>][]
    >()
    const dirtyInstanceSet = new Set(instances)
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
      hmrDirtyComponentsMode.set(oldComp, !!isVapor)

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
        const parent = instance.parent
        if (!hasDirtyAncestor(instance, dirtyInstanceSet)) {
          let updates = parentUpdates.get(parent)
          if (!updates) {
            parentUpdates.set(parent, (updates = []))
          }
          updates.push([instance, dirtyInstances])
        }
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
    parentUpdates.forEach((updates, parent) => {
      queueJob(() => {
        isHmrUpdating = true
        if (parent.vapor) {
          parent.hmrRerender!()
        } else {
          const i = parent as ComponentInternalInstance
          if (!(i.effect.flags! & EffectFlags.STOP)) {
            i.renderCache = []
            i.effect.run()
          }
        }
        nextTick(() => {
          isHmrUpdating = false
        })
        // #6930, #11248 avoid infinite recursion
        updates.forEach(([instance, dirtyInstances]) => {
          dirtyInstances.delete(instance)
        })
      })
    })
  }
  // 5. make sure to cleanup dirty hmr components after update
  queuePostFlushCb(() => {
    hmrDirtyComponents.clear()
    hmrDirtyComponentsMode.clear()
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
