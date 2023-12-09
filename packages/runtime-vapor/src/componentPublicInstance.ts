import { hasOwn } from '@vue/shared'
import { type ComponentInternalInstance } from './component'

export interface ComponentRenderContext {
  [key: string]: any
  _: ComponentInternalInstance
}

export const PublicInstanceProxyHandlers: ProxyHandler<any> = {
  get({ _: instance }: ComponentRenderContext, key: string) {
    let normalizedProps
    const { setupState, props } = instance
    if (hasOwn(setupState, key)) {
      return setupState[key]
    } else if (
      (normalizedProps = instance.propsOptions[0]) &&
      hasOwn(normalizedProps, key)
    ) {
      return props![key]
    }
  },
}
