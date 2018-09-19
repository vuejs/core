import { MountedComponent } from './component'
import { ComponentWatchOptions } from './componentOptions'
import { autorun, stop, Autorun } from '@vue/observer'

export function initializeWatch(
  instance: MountedComponent,
  options: ComponentWatchOptions | undefined
) {
  if (options !== void 0) {
    for (const key in options) {
      setupWatcher(instance, key, options[key])
    }
  }
}

// TODO deep watch
export function setupWatcher(
  instance: MountedComponent,
  keyOrFn: string | Function,
  cb: Function
): () => void {
  const handles = instance._watchHandles || (instance._watchHandles = new Set())
  const proxy = instance.$proxy
  const rawGetter =
    typeof keyOrFn === 'string'
      ? () => proxy[keyOrFn]
      : () => keyOrFn.call(proxy)
  let oldValue: any
  const runner = autorun(rawGetter, {
    scheduler: (runner: Autorun) => {
      const newValue = runner()
      if (newValue !== oldValue) {
        cb(newValue, oldValue)
        oldValue = newValue
      }
    }
  })
  oldValue = runner()
  handles.add(runner)
  return () => {
    stop(runner)
    handles.delete(runner)
  }
}

export function teardownWatch(instance: MountedComponent) {
  if (instance._watchHandles !== null) {
    instance._watchHandles.forEach(stop)
  }
}
