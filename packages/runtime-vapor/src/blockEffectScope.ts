import { EffectScope } from '@vue/reactivity'
import type { ComponentInternalInstance } from './component'
import type { DirectiveBindingsMap } from './directives'

export class BlockEffectScope extends EffectScope {
  /**
   * instance
   * @internal
   */
  it: ComponentInternalInstance
  /**
   * isMounted
   * @internal
   */
  im: boolean
  /**
   * directives
   * @internal
   */
  dirs?: DirectiveBindingsMap

  constructor(
    instance: ComponentInternalInstance,
    parentScope: EffectScope | null,
  ) {
    super(false, parentScope || undefined)
    this.im = false
    this.it = instance
  }
}

export function isRenderEffectScope(
  scope: EffectScope | undefined,
): scope is BlockEffectScope {
  return scope instanceof BlockEffectScope
}
