import { toHandlers as _toHandlers } from '@vue/runtime-shared'
import { warn } from '../warning'
import { NOOP } from '@vue/shared'

export const toHandlers = _toHandlers.bind(undefined, __DEV__ ? warn : NOOP)
