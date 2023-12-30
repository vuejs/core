import {
  type AsyncComponentLoader,
  defineAsyncComponent,
  defineComponent,
} from 'vue'
import { describe, expectType } from './utils'

describe('defineAsyncComponent', () => {
  const Comp = defineAsyncComponent(async () => ({
    props: { n: Number },
    myProp: 'foo',
    setup(props) {
      expectType<number | undefined>(props.n)

      // @ts-expect-error not any
      expectType<string>(props.n)

      return {
        foo: 'foo',
      }
    },
  }))

  // @ts-expect-error should not be part of the type
  Comp.props
  // @ts-expect-error should not be part of the type
  Comp.myProp

  // @ts-expect-error should not be an array
  Comp.__asyncResolved.props.at

  expectType<{ n: NumberConstructor }>(Comp.__asyncResolved!.props)
  expectType<string>(Comp.__asyncResolved!.myProp)

  expectType<'AsyncComponentWrapper'>(Comp.name)
  ;<Comp n={1} />
  // @ts-expect-error invalid prop type
  ;<Comp n={'111'} />

  expectType<string>(new Comp().foo)

  expectType<number | undefined>(new Comp().$props.n)
  expectType<number | undefined>(new Comp().n)
})

describe('with component', () => {
  const Comp = defineComponent({
    props: ['a'],
    foo: 'foo',
  })

  const AsyncComp = defineAsyncComponent(async () => Comp)

  expectType<typeof Comp>(AsyncComp.__asyncResolved!)
  expectType<AsyncComponentLoader<typeof Comp>>(AsyncComp.__asyncLoader)
})
