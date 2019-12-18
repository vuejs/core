import { getCurrentInstance } from '../component'
import { EMPTY_OBJ } from '@vue/shared'
import { warn } from '../warning'

export function useCSSModule(name = '$style'): Record<string, string> {
  const instance = getCurrentInstance()!
  if (!instance) {
    __DEV__ && warn(`useCSSModule must be called inside setup()`)
    return EMPTY_OBJ
  }
  const modules = instance.type.__cssModules
  if (!modules) {
    __DEV__ && warn(`Current instance does not have CSS modules injected.`)
    return EMPTY_OBJ
  }
  const mod = modules[name]
  if (!mod) {
    __DEV__ &&
      warn(`Current instance does not have CSS module named "${name}".`)
    return EMPTY_OBJ
  }
  return mod as Record<string, string>
}
