import { EffectScope } from '@vue/reactivity'
import { EMPTY_OBJ, isFunction } from '@vue/shared'
import type { Block } from './apiRender'
import type { DirectiveBinding } from './directives'
import {
  type ComponentPropsOptions,
  type NormalizedPropsOptions,
  type NormalizedRawProps,
  type RawProps,
  initProps,
  normalizePropsOptions,
} from './componentProps'
import {
  type EmitFn,
  type EmitsOptions,
  type ObjectEmitsOptions,
  emit,
  normalizeEmitsOptions,
} from './componentEmits'
import { VaporLifecycleHooks } from './apiLifecycle'

import type { Data } from '@vue/shared'

export type Component = FunctionalComponent | ObjectComponent

export type SetupFn = (props: any, ctx: any) => Block | Data | void
export type FunctionalComponent = SetupFn & Omit<ObjectComponent, 'setup'>

export interface ObjectComponent {
  props?: ComponentPropsOptions
  emits?: EmitsOptions
  setup?: SetupFn
  render?(ctx: any): Block
  vapor?: boolean
}

type LifecycleHook<TFn = Function> = TFn[] | null

export interface ComponentInternalInstance {
  uid: number
  vapor: true

  block: Block | null
  container: ParentNode
  parent: ComponentInternalInstance | null

  scope: EffectScope
  component: FunctionalComponent | ObjectComponent
  comps: Set<ComponentInternalInstance>
  dirs: Map<Node, DirectiveBinding[]>

  rawProps: NormalizedRawProps
  propsOptions: NormalizedPropsOptions
  emitsOptions: ObjectEmitsOptions | null

  // state
  setupState: Data
  props: Data
  emit: EmitFn
  emitted: Record<string, boolean> | null
  attrs: Data
  refs: Data

  // lifecycle
  isMounted: boolean
  isUnmounted: boolean
  isUpdating: boolean
  // TODO: registory of provides, lifecycles, ...
  /**
   * @internal
   */
  [VaporLifecycleHooks.BEFORE_MOUNT]: LifecycleHook
  /**
   * @internal
   */
  [VaporLifecycleHooks.MOUNTED]: LifecycleHook
  /**
   * @internal
   */
  [VaporLifecycleHooks.BEFORE_UPDATE]: LifecycleHook
  /**
   * @internal
   */
  [VaporLifecycleHooks.UPDATED]: LifecycleHook
  /**
   * @internal
   */
  [VaporLifecycleHooks.BEFORE_UNMOUNT]: LifecycleHook
  /**
   * @internal
   */
  [VaporLifecycleHooks.UNMOUNTED]: LifecycleHook
  /**
   * @internal
   */
  [VaporLifecycleHooks.RENDER_TRACKED]: LifecycleHook
  /**
   * @internal
   */
  [VaporLifecycleHooks.RENDER_TRIGGERED]: LifecycleHook
  /**
   * @internal
   */
  [VaporLifecycleHooks.ACTIVATED]: LifecycleHook
  /**
   * @internal
   */
  [VaporLifecycleHooks.DEACTIVATED]: LifecycleHook
  /**
   * @internal
   */
  [VaporLifecycleHooks.ERROR_CAPTURED]: LifecycleHook
  /**
   * @internal
   */
  // [VaporLifecycleHooks.SERVER_PREFETCH]: LifecycleHook<() => Promise<unknown>>
}

// TODO
export let currentInstance: ComponentInternalInstance | null = null

export const getCurrentInstance: () => ComponentInternalInstance | null = () =>
  currentInstance

export const setCurrentInstance = (instance: ComponentInternalInstance) => {
  const prev = currentInstance
  currentInstance = instance
  instance.scope.on()
  return () => {
    instance.scope.off()
    currentInstance = prev
  }
}

export const unsetCurrentInstance = () => {
  currentInstance?.scope.off()
  currentInstance = null
}

let uid = 0
export function createComponentInstance(
  component: ObjectComponent | FunctionalComponent,
  rawProps: RawProps | null,
): ComponentInternalInstance {
  const instance: ComponentInternalInstance = {
    uid: uid++,
    vapor: true,

    block: null,
    container: null!,

    // TODO
    parent: null,

    scope: new EffectScope(true /* detached */)!,
    component,
    comps: new Set(),
    dirs: new Map(),

    // resolved props and emits options
    rawProps: null!, // set later
    propsOptions: normalizePropsOptions(component),
    emitsOptions: normalizeEmitsOptions(component),

    // state
    setupState: EMPTY_OBJ,
    props: EMPTY_OBJ,
    emit: null!,
    emitted: null,
    attrs: EMPTY_OBJ,
    refs: EMPTY_OBJ,

    // lifecycle
    isMounted: false,
    isUnmounted: false,
    isUpdating: false,
    // TODO: registory of provides, appContext, lifecycles, ...
    /**
     * @internal
     */
    [VaporLifecycleHooks.BEFORE_MOUNT]: null,
    /**
     * @internal
     */
    [VaporLifecycleHooks.MOUNTED]: null,
    /**
     * @internal
     */
    [VaporLifecycleHooks.BEFORE_UPDATE]: null,
    /**
     * @internal
     */
    [VaporLifecycleHooks.UPDATED]: null,
    /**
     * @internal
     */
    [VaporLifecycleHooks.BEFORE_UNMOUNT]: null,
    /**
     * @internal
     */
    [VaporLifecycleHooks.UNMOUNTED]: null,
    /**
     * @internal
     */
    [VaporLifecycleHooks.RENDER_TRACKED]: null,
    /**
     * @internal
     */
    [VaporLifecycleHooks.RENDER_TRIGGERED]: null,
    /**
     * @internal
     */
    [VaporLifecycleHooks.ACTIVATED]: null,
    /**
     * @internal
     */
    [VaporLifecycleHooks.DEACTIVATED]: null,
    /**
     * @internal
     */
    [VaporLifecycleHooks.ERROR_CAPTURED]: null,
    /**
     * @internal
     */
    // [VaporLifecycleHooks.SERVER_PREFETCH]: null,
  }
  initProps(instance, rawProps, !isFunction(component))
  instance.emit = emit.bind(null, instance)

  return instance
}
