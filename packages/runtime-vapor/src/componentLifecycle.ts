import { invokeArrayFns } from '@vue/shared'
import type { VaporLifecycleHooks } from './apiLifecycle'
import { type ComponentInternalInstance, setCurrentInstance } from './component'
import { queuePostRenderEffect } from './scheduler'
import { type DirectiveHookName, invokeDirectiveHook } from './directives'

export function invokeLifecycle(
  instance: ComponentInternalInstance,
  lifecycle: VaporLifecycleHooks,
  directive: DirectiveHookName,
  post?: boolean,
) {
  invokeArrayFns(post ? [invokeSub, invokeCurrent] : [invokeCurrent, invokeSub])

  function invokeCurrent() {
    const hooks = instance[lifecycle]
    if (hooks) {
      const fn = () => {
        const reset = setCurrentInstance(instance)
        invokeArrayFns(hooks)
        reset()
      }
      post ? queuePostRenderEffect(fn) : fn()
    }

    invokeDirectiveHook(instance, directive)
  }

  function invokeSub() {
    instance.comps.forEach(comp =>
      invokeLifecycle(comp, lifecycle, directive, post),
    )
  }
}
