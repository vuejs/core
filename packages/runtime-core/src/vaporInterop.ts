import type {
  ComponentInternalInstance,
  GenericComponentInstance,
} from './component'
import type { VNode } from './vnode'

/**
 * The vapor in vdom implementation is in runtime-vapor/src/vdomInterop.ts
 * @internal
 */
export interface VaporInteropInterface {
  mount(
    vnode: VNode,
    container: any,
    anchor: any,
    parentComponent: ComponentInternalInstance | null,
  ): GenericComponentInstance // VaporComponentInstance
  update(n1: VNode, n2: VNode, shouldUpdate: boolean): void
  unmount(vnode: VNode, doRemove?: boolean): void
  move(vnode: VNode, container: any, anchor: any): void
}
