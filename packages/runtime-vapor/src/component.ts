import { EffectScope } from '@vue/reactivity'
import { Block } from './render'
import { DirectiveBinding } from './directives'
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
  isMounted: boolean

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
  const instance: ComponentInternalInstance = {
    uid: uid++,
    block: null,
    container: null!, // set on mount
    scope: new EffectScope(true /* detached */)!,

    component,
    isMounted: false,

    dirs: new Map(),
    // TODO: registory of provides, appContext, lifecycles, ...
  }
  return instance
}
