import {
  type $ as _$,
  type $$ as _$$,
  type $ref as _$ref,
  type $shallowRef as _$shallowRef,
  type $computed as _$computed,
  type $customRef as _$customRef,
  type $toRef as _$toRef,
} from './macros'

declare global {
  const $: typeof _$
  const $$: typeof _$$
  const $ref: typeof _$ref
  const $shallowRef: typeof _$shallowRef
  const $computed: typeof _$computed
  const $customRef: typeof _$customRef
  const $toRef: typeof _$toRef
}
