import { type Ref, EffectScope, ref } from '@vue/reactivity'
import type { Block } from './render'
import type { DirectiveBinding } from './directive'
import type { Data } from '@vue/shared'

export type SetupFn = (props: any, ctx: any) => Block | Data
export type FunctionalComponent = SetupFn & {
  render(ctx: any): Block
}
export interface ObjectComponent {
  setup: SetupFn
  render(ctx: any): Block
}

export interface ComponentInternalInstance {
  uid: number
  container: ParentNode
  block: Block | null
  scope: EffectScope

  component: FunctionalComponent | ObjectComponent
  get isMounted(): boolean
  isMountedRef: Ref<boolean>

  /** directives */
  dirs: Map<Node, DirectiveBinding[]>
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
    get isMounted() {
      return isMountedRef.value
    },
    isMountedRef,

    dirs: new Map(),
    // TODO: registory of provides, appContext, lifecycles, ...
  }
  return instance
}
