import {
  ComponentInternalInstance,
  ComponentOptions,
  RenderFunction
} from './component'

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
    isRecorded: tryWrap(isRecorded),
    createRecord: tryWrap(createRecord),
    rerender: tryWrap(rerender),
    reload: tryWrap(reload)
  }
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

function isRecorded(id: string): boolean {
  return map.has(id)
}

function createRecord(id: string, comp: ComponentOptions) {
  if (map.has(id)) {
    return
  }
  map.set(id, {
    comp,
    instances: new Set()
  })
}

function rerender(id: string, newRender: RenderFunction) {
  map.get(id)!.instances.forEach(instance => {
    instance.render = newRender
    instance.renderCache = []
    instance.update()
    // TODO force scoped slots passed to children to have DYNAMIC_SLOTS flag
  })
}

function reload(id: string, newComp: ComponentOptions) {
  // TODO
  console.log('reload', id)
}

function tryWrap(fn: (id: string, arg: any) => void): Function {
  return (id: string, arg: any) => {
    try {
      fn(id, arg)
    } catch (e) {
      console.error(e)
      console.warn(
        `Something went wrong during Vue component hot-reload. ` +
          `Full reload required.`
      )
    }
  }
}
