import { invokeArrayFns, isFunction } from '@vue/shared'
import {
  type ComponentInternalInstance,
  currentInstance,
  isVaporComponent,
  setCurrentInstance,
} from './component'
import {
  EffectFlags,
  ReactiveEffect,
  type SchedulerJob,
  getCurrentScope,
  pauseTracking,
  resetTracking,
  traverse,
} from '@vue/reactivity'
import {
  VaporErrorCodes,
  callWithAsyncErrorHandling,
  callWithErrorHandling,
} from './errorHandling'
import { queueJob, queuePostFlushCb } from './scheduler'
import { warn } from './warning'
import { type BlockEffectScope, isRenderEffectScope } from './blockEffectScope'
import { normalizeBlock } from './dom/element'

export type DirectiveModifiers<M extends string = string> = Record<M, boolean>

export interface DirectiveBinding<T = any, V = any, M extends string = string> {
  instance: ComponentInternalInstance
  source?: () => V
  value: V
  oldValue: V | null
  arg?: string
  modifiers?: DirectiveModifiers<M>
  dir: ObjectDirective<T, V, M>
}

export type DirectiveBindingsMap = Map<Node, DirectiveBinding[]>

export type DirectiveHook<
  T = any | null,
  V = any,
  M extends string = string,
> = (node: T, binding: DirectiveBinding<T, V, M>) => void

// create node -> `created` -> node operation -> `beforeMount` -> node mounted -> `mounted`
// effect update -> `beforeUpdate` -> node updated -> `updated`
// `beforeUnmount`-> node unmount -> `unmounted`
export type DirectiveHookName =
  | 'created'
  | 'beforeMount'
  | 'mounted'
  | 'beforeUpdate'
  | 'updated'
  | 'beforeUnmount'
  | 'unmounted'
export type ObjectDirective<T = any, V = any, M extends string = string> = {
  [K in DirectiveHookName]?: DirectiveHook<T, V, M> | undefined
} & {
  /** Watch value deeply */
  deep?: boolean | number
}

export type FunctionDirective<
  T = any,
  V = any,
  M extends string = string,
> = DirectiveHook<T, V, M>

export type Directive<T = any, V = any, M extends string = string> =
  | ObjectDirective<T, V, M>
  | FunctionDirective<T, V, M>

export type DirectiveArguments = Array<
  | [Directive | undefined]
  | [Directive | undefined, () => any]
  | [Directive | undefined, () => any, argument: string]
  | [
      Directive | undefined,
      value: () => any,
      argument: string,
      modifiers: DirectiveModifiers,
    ]
>

export function withDirectives<T extends ComponentInternalInstance | Node>(
  nodeOrComponent: T,
  directives: DirectiveArguments,
): T {
  if (!currentInstance) {
    __DEV__ && warn(`withDirectives can only be used inside render functions.`)
    return nodeOrComponent
  }

  let node: Node
  if (isVaporComponent(nodeOrComponent)) {
    const root = getComponentNode(nodeOrComponent)
    if (!root) return nodeOrComponent
    node = root
  } else {
    node = nodeOrComponent
  }

  let bindings: DirectiveBinding[]
  const instance = currentInstance!
  const parentScope = getCurrentScope() as BlockEffectScope

  if (__DEV__ && !isRenderEffectScope(parentScope)) {
    warn(`Directives should be used inside of RenderEffectScope.`)
  }

  const directivesMap = (parentScope.dirs ||= new Map())
  if (!(bindings = directivesMap.get(node))) {
    directivesMap.set(node, (bindings = []))
  }

  for (const directive of directives) {
    let [dir, source, arg, modifiers] = directive
    if (!dir) continue
    if (isFunction(dir)) {
      dir = {
        mounted: dir,
        updated: dir,
      } satisfies ObjectDirective
    }

    const binding: DirectiveBinding = {
      dir,
      instance,
      value: null, // set later
      oldValue: undefined,
      arg,
      modifiers,
    }

    if (source) {
      if (dir.deep) {
        const deep = dir.deep === true ? undefined : dir.deep
        const baseSource = source
        source = () => traverse(baseSource(), deep)
      }

      const effect = new ReactiveEffect(() =>
        callWithErrorHandling(
          source!,
          instance,
          VaporErrorCodes.RENDER_FUNCTION,
        ),
      )
      const triggerRenderingUpdate = createRenderingUpdateTrigger(
        instance,
        effect,
      )
      effect.scheduler = () => queueJob(triggerRenderingUpdate)

      binding.source = effect.run.bind(effect)
    }

    bindings.push(binding)

    callDirectiveHook(node, binding, instance, 'created')
  }

  return nodeOrComponent
}

function getComponentNode(component: ComponentInternalInstance) {
  if (!component.block) return

  const nodes = normalizeBlock(component.block)
  if (nodes.length !== 1) {
    warn(
      `Runtime directive used on component with non-element root node. ` +
        `The directives will not function as intended.`,
    )
    return
  }

  return nodes[0]
}

export function invokeDirectiveHook(
  instance: ComponentInternalInstance | null,
  name: DirectiveHookName,
  scope: BlockEffectScope,
) {
  const { dirs } = scope
  if (name === 'mounted') scope.im = true
  if (!dirs) return
  const iterator = dirs.entries()
  for (const [node, bindings] of iterator) {
    for (const binding of bindings) {
      callDirectiveHook(node, binding, instance, name)
    }
  }
}

function callDirectiveHook(
  node: Node,
  binding: DirectiveBinding,
  instance: ComponentInternalInstance | null,
  name: DirectiveHookName,
) {
  if (name === 'beforeUpdate') binding.oldValue = binding.value
  const { dir } = binding
  const hook = dir[name]
  if (!hook) return

  const newValue = binding.source ? binding.source() : undefined
  binding.value = newValue
  // disable tracking inside all lifecycle hooks
  // since they can potentially be called inside effects.
  pauseTracking()
  callWithAsyncErrorHandling(hook, instance, VaporErrorCodes.DIRECTIVE_HOOK, [
    node,
    binding,
  ])
  resetTracking()
}

export function createRenderingUpdateTrigger(
  instance: ComponentInternalInstance,
  effect: ReactiveEffect,
): SchedulerJob {
  job.id = instance.uid
  return job
  function job() {
    if (!(effect.flags & EffectFlags.ACTIVE) || !effect.dirty) {
      return
    }

    if (instance.isMounted && !instance.isUpdating) {
      instance.isUpdating = true
      const reset = setCurrentInstance(instance)

      const { bu, u, scope } = instance
      const { dirs } = scope
      // beforeUpdate hook
      if (bu) {
        invokeArrayFns(bu)
      }
      invokeDirectiveHook(instance, 'beforeUpdate', scope)

      queuePostFlushCb(() => {
        instance.isUpdating = false
        const reset = setCurrentInstance(instance)
        if (dirs) {
          invokeDirectiveHook(instance, 'updated', scope)
        }
        // updated hook
        if (u) {
          queuePostFlushCb(u)
        }
        reset()
      })
      reset()
    }
  }
}
