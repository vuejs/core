import {
  $ as _$,
  $$ as _$$,
  $ref as _$ref,
  $shallowRef as _$shallowRef,
  $computed as _$computed,
  $customRef as _$customRef,
  $toRef as _$toRef
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
