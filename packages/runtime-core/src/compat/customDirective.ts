import { isArray } from '@vue/shared'
import { ObjectDirective, DirectiveHook } from '../directives'
import { DeprecationTypes, warnDeprecation } from './deprecations'

export interface LegacyDirective {
  bind?: DirectiveHook
  inserted?: DirectiveHook
  update?: DirectiveHook
  componentUpdated?: DirectiveHook
  unbind?: DirectiveHook
}

const legacyDirectiveHookMap: Partial<
  Record<
    keyof ObjectDirective,
    keyof LegacyDirective | (keyof LegacyDirective)[]
  >
> = {
  beforeMount: 'bind',
  mounted: 'inserted',
  updated: ['update', 'componentUpdated'],
  unmounted: 'unbind'
}

export function mapCompatDirectiveHook(
  name: keyof ObjectDirective,
  dir: ObjectDirective & LegacyDirective
): DirectiveHook | DirectiveHook[] | undefined {
  const mappedName = legacyDirectiveHookMap[name]
  if (mappedName) {
    if (isArray(mappedName)) {
      const hook: DirectiveHook[] = []
      mappedName.forEach(name => {
        const mappedHook = dir[name]
        if (mappedHook) {
          __DEV__ &&
            warnDeprecation(DeprecationTypes.CUSTOM_DIR, mappedName, name)
          hook.push(mappedHook)
        }
      })
      return hook.length ? hook : undefined
    } else {
      if (__DEV__ && dir[mappedName]) {
        warnDeprecation(DeprecationTypes.CUSTOM_DIR, mappedName, name)
      }
      return dir[mappedName]
    }
  }
}
