import {
  type SetupContext,
  createSetupContext,
  getCurrentInstance,
} from './component'
import { warn } from './warning'

// TODO: warning compiler-macros runtime usages

export function useSlots(): SetupContext['slots'] {
  return getContext().slots
}

export function useAttrs(): SetupContext['attrs'] {
  return getContext().attrs
}

function getContext(): SetupContext {
  const i = getCurrentInstance()!
  if (__DEV__ && !i) {
    warn(`useContext() called without active instance.`)
  }
  return i.setupContext || (i.setupContext = createSetupContext(i))
}
