import { toHandlers as _toHandlers } from '@vue/runtime-shared'
import { warn } from '../warning'

export const toHandlers = _toHandlers.bind(undefined, warn)
