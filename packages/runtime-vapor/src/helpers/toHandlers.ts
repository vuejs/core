import { toHandlers as _toHandlers } from '@vue/runtime-shared'
import { warn } from '../warning'
import { NOOP } from '@vue/shared'

export const toHandlers: (
  obj: Record<string, any>,
  preserveCaseIfNecessary?: boolean | undefined,
) => Record<string, any> = _toHandlers.bind(undefined, __DEV__ ? warn : NOOP)
