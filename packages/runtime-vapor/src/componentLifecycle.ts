import { invokeArrayFns } from '@vue/shared'
import type { VaporLifecycleHooks } from './apiLifecycle'
import { type ComponentInternalInstance, setCurrentInstance } from './component'
import { queuePostFlushCb } from './scheduler'
import { type DirectiveHookName, invokeDirectiveHook } from './directives'

export function invokeLifecycle(
  instance: ComponentInternalInstance,
  lifecycle: VaporLifecycleHooks,
  directive: DirectiveHookName,
  cb?: (instance: ComponentInternalInstance) => void,
  post?: boolean,
) {
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

    invokeDirectiveHook(instance, directive)
  }

  function invokeSub() {
    instance.comps.forEach(comp =>
      invokeLifecycle(comp, lifecycle, directive, cb, post),
    )
  }
}
