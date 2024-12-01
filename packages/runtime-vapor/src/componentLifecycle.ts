import { invokeArrayFns } from '@vue/shared'
import type { VaporLifecycleHooks } from './enums'
import { type ComponentInternalInstance, setCurrentInstance } from './component'
import { queuePostFlushCb } from './scheduler'

export function invokeLifecycle(
  instance: ComponentInternalInstance,
  lifecycle: VaporLifecycleHooks,
  cb?: (instance: ComponentInternalInstance) => void,
  post?: boolean,
): void {
  invokeArrayFns(post ? [invokeSub, invokeCurrent] : [invokeCurrent, invokeSub])

  function invokeCurrent() {
    cb && cb(instance)
    const hooks = instance[lifecycle]
    if (hooks) {
      const fn = () => {
        const reset = setCurrentInstance(instance)
        instance.scope.run(() => invokeArrayFns(hooks))
        reset()
      }
      post ? queuePostFlushCb(fn) : fn()
    }
  }

  function invokeSub() {
    // instance.comps.forEach(comp => invokeLifecycle(comp, lifecycle, cb, post))
  }
}
