import type { VNodeRef } from '@vue/runtime-core'

export type ReservedProps = {
  key?: string | number | symbol
  ref?: VNodeRef
  ref_for?: boolean
  ref_key?: string
}
