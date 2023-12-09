import { EffectScope, Ref, ref } from '@vue/reactivity'

import { EMPTY_OBJ } from '@vue/shared'
import { Block } from './render'
import { type DirectiveBinding } from './directive'
import {
  type ComponentPropsOptions,
  type NormalizedPropsOptions,
  normalizePropsOptions,
} from './componentProps'

import type { Data } from '@vue/shared'

export type Component = FunctionalComponent | ObjectComponent

export type SetupFn = (props: any, ctx: any) => Block | Data
export type FunctionalComponent = SetupFn & {
  props: ComponentPropsOptions
  render(ctx: any): Block
}
export interface ObjectComponent {
  props: ComponentPropsOptions
  setup: SetupFn
  render(ctx: any): Block
}

export interface ComponentInternalInstance {
  uid: number
  container: ParentNode
  block: Block | null
  scope: EffectScope
  component: FunctionalComponent | ObjectComponent
  propsOptions: NormalizedPropsOptions

  // TODO: type
  proxy: Data | null

  // state
  props: Data
  setupState: Data

  /** directives */
  dirs: Map<Node, DirectiveBinding[]>

  // lifecycle
  get isMounted(): boolean
  isMountedRef: Ref<boolean>
  // TODO: registory of provides, appContext, lifecycles, ...
}

// TODO
export let currentInstance: ComponentInternalInstance | null = null

export const getCurrentInstance: () => ComponentInternalInstance | null = () =>
  currentInstance

export const setCurrentInstance = (instance: ComponentInternalInstance) => {
  currentInstance = instance
}

export const unsetCurrentInstance = () => {
  currentInstance = null
}

let uid = 0
export const createComponentInstance = (
  component: ObjectComponent | FunctionalComponent,
): ComponentInternalInstance => {
  const isMountedRef = ref(false)
  const instance: ComponentInternalInstance = {
    uid: uid++,
    block: null,
    container: null!, // set on mount
    scope: new EffectScope(true /* detached */)!,
    component,

    // resolved props and emits options
    propsOptions: normalizePropsOptions(component),
    // emitsOptions: normalizeEmitsOptions(type, appContext), // TODO:

    proxy: null,

    // state
    props: EMPTY_OBJ,
    setupState: EMPTY_OBJ,

    dirs: new Map(),

    // lifecycle
    get isMounted() {
      return isMountedRef.value
    },
    isMountedRef,
    // TODO: registory of provides, appContext, lifecycles, ...
  }
  return instance
}
