import { defineComponent, defineProps } from 'vue'
import { describe, expectType } from './utils'

// #14366
describe('exactOptionalPropertyTypes', () => {
  const Child = defineComponent({
    props: {
      foo: String,
    },
  })

  const WithDefault = defineComponent({
    props: {
      foo: {
        type: String,
        default: 'foo',
      },
    },
  })

  const props = defineProps<{
    foo?: string
  }>()

  expectType<JSX.Element>(<Child {...props} />)
  expectType<JSX.Element>(<Child foo={undefined} />)
  expectType<JSX.Element>(<WithDefault foo={undefined} />)
})
