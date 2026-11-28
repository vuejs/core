// type checked with `exactOptionalPropertyTypes: true`, see
// tsconfig.exactOptionalPropertyTypes.json
import { defineComponent, defineProps, h, withDefaults } from 'vue'
import { describe, expectType } from './utils'

// #14366
describe('exactOptionalPropertyTypes', () => {
  type CompProps = {
    required: number
    optional?: string
  }

  // equivalent of `defineProps<CompProps>()` in `<script setup>`
  const Comp = defineComponent({
    __typeProps: {} as CompProps,
  })

  // `{ required: number; optional: string | undefined }`
  const props = defineProps<CompProps>()
  expectType<string | undefined>(props.optional)

  // v-bind="props"
  expectType<JSX.Element>(<Comp {...props} />)
  expectType<JSX.Element>(<Comp required={1} optional={undefined} />)
  expectType<JSX.Element>(<Comp required={1} />)
  h(Comp, props)

  expectType<JSX.Element>(
    <Comp {...withDefaults(defineProps<CompProps>(), { optional: 'foo' })} />,
  )

  // @ts-expect-error missing required prop
  ;<Comp optional="foo" />
  // @ts-expect-error required props still reject undefined
  ;<Comp required={undefined} />
  // @ts-expect-error
  ;<Comp required={1} optional={1} />

  // runtime props, including props with a default
  const RuntimeComp = defineComponent({
    props: {
      required: { type: Number, required: true },
      optional: String,
      withDefault: { type: String, default: 'foo' },
    },
  })
  const runtimeProps = defineProps<{
    required: number
    optional?: string
    withDefault?: string
  }>()

  expectType<JSX.Element>(<RuntimeComp {...runtimeProps} />)
  expectType<JSX.Element>(<RuntimeComp required={1} optional={undefined} />)
  expectType<JSX.Element>(<RuntimeComp required={1} withDefault={undefined} />)
  expectType<JSX.Element>(<RuntimeComp required={1} />)
  h(RuntimeComp, runtimeProps)

  // @ts-expect-error
  ;<RuntimeComp required={undefined} />
  // @ts-expect-error
  ;<RuntimeComp required={1} withDefault={1} />

  // function signature
  const FnComp = defineComponent((_props: CompProps) => () => null)
  expectType<JSX.Element>(<FnComp {...props} />)
  expectType<JSX.Element>(<FnComp required={1} optional={undefined} />)
  // @ts-expect-error
  ;<FnComp required={undefined} />
})
