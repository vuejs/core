import { NOOP } from '@vue/shared'
import { createStructuralDirectiveTransform } from '@vue/compiler-core'

export const transformCloak = createStructuralDirectiveTransform('cloak', NOOP)
