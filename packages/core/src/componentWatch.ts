import { MountedComponent } from './component'
import { ComponentWatchOptions } from './componentOptions'
import { autorun, stop } from '@vue/observer'
import { queueJob } from '@vue/scheduler'

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
// TODO sync watch
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

  const applyCb = () => {
    const newValue = runner()
    if (newValue !== oldValue) {
      cb(newValue, oldValue)
      oldValue = newValue
    }
  }

  const runner = autorun(rawGetter, {
    scheduler: () => {
      // defer watch callback using the scheduler so that multiple mutations
      // result in one call only.
      queueJob(applyCb)
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
