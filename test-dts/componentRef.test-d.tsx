import {
  expectError,
  Ref,
  defineComponent,
  ComponentPublicInstance,
  FunctionalComponent,
  expectType
} from './index'

// html component ref
declare let videoEl: HTMLVideoElement | null
declare let videoElRef: Ref<HTMLVideoElement | null>
;<video ref={e => (videoEl = e)} />
;<video ref={videoElRef} />

// @ts-expect-error
expectError(<a ref={e => (videoEl = e)} />)
// @ts-expect-error
expectError(<a ref={videoEl} />)

const Comp = defineComponent({
  props: {
    test: String
  }
})

// Component based ref
declare let myComp: InstanceType<typeof Comp> | null
declare let myCompRef: Ref<InstanceType<typeof Comp> | null>
declare let anyComp: ComponentPublicInstance | null
expectType<JSX.Element>(<Comp ref={e => (myComp = e)} />)
expectType<JSX.Element>(<Comp ref={myCompRef} />)
expectType<JSX.Element>(<Comp ref={e => (anyComp = e)} />)

declare let wrongComponent: ComponentPublicInstance<{ a: string }>

// @ts-expect-error wrong Component type
expectType<JSX.Element>(<Comp ref={e => (wrongComponent = e)} />)

// Function
declare function FuncComp(props: { foo: string }): any

expectType<JSX.Element>(<FuncComp foo="test" ref={e => e?.$props.foo} />)

// @ts-expect-error not valid prop
expectType<JSX.Element>(<FuncComp foo="test" ref={e => e?.$props.bar} />)

declare const FuncEmitComp: FunctionalComponent<{ foo: string }, ['test']>

expectType<JSX.Element>(
  <FuncEmitComp foo="test" ref={e => e?.$props.foo && e?.$emit('test')} />
)

// @ts-expect-error not valid prop
expectType<JSX.Element>(<FuncEmitComp foo="test" ref={e => e?.$props.bar} />)

// @ts-expect-error not valid emit
expectType<JSX.Element>(<FuncEmitComp foo="test" ref={e => e?.$emit('bar')} />)

// Class
declare const CustomComp: {
  new (): { $props: { foo: string } }
}

declare let customComp: InstanceType<typeof CustomComp> | null
expectType<JSX.Element>(<CustomComp foo="test" ref={e => (customComp = e)} />)

// @ts-expect-error not valid prop
expectType<JSX.Element>(<CustomComp foo="test" ref={e => e?.$props.bar} />)
