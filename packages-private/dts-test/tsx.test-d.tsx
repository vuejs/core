// TSX w/ defineComponent is tested in defineComponent.test-d.tsx
import {
  Fragment,
  KeepAlive,
  Suspense,
  Teleport,
  type VNode,
  useAttrs,
} from 'vue'
import { expectType } from './utils'

expectType(<div />, {} as VNode)
expectType(<div />, {} as JSX.Element)
expectType(<div id="foo" />, {} as JSX.Element)
expectType(<div>hello</div>, {} as JSX.Element)
expectType(<input value="foo" />, {} as JSX.Element)
expectType(<textarea value={null} />, {} as JSX.Element)

// @ts-expect-error style css property validation
;<div style={{ unknown: 123 }} />

// allow array styles and nested array styles
expectType(<div style={[{ color: 'red' }]} />, {} as JSX.Element)
expectType(
  <div style={[{ color: 'red' }, [{ fontSize: '1em' }]]} />,
  {} as JSX.Element,
)

// allow undefined, string, object, array and nested array classes
expectType(<div class={undefined} />, {} as JSX.Element)
expectType(<div class={'foo'} />, {} as JSX.Element)
expectType(<div class={['foo', undefined, 'bar']} />, {} as JSX.Element)
expectType(<div class={[]} />, {} as JSX.Element)
expectType(<div class={['foo', ['bar'], [['baz']]]} />, {} as JSX.Element)
expectType(
  <div class={{ foo: true, bar: false, baz: true }} />,
  {} as JSX.Element,
)
expectType(<div class={{}} />, {} as JSX.Element)
expectType(
  <div class={['foo', ['bar'], { baz: true }, [{ qux: true }]]} />,
  {} as JSX.Element,
)
expectType(
  <div
    class={[
      { foo: false },
      { bar: 0 },
      { baz: -0 },
      { qux: '' },
      { quux: null },
      { corge: undefined },
      { grault: NaN },
    ]}
  />,
  {} as JSX.Element,
)
expectType(
  <div
    class={[
      { foo: true },
      { bar: 'not-empty' },
      { baz: 1 },
      { qux: {} },
      { quux: [] },
    ]}
  />,
  {} as JSX.Element,
)

// allow class/style passthrough from attrs
const attrs = useAttrs()
expectType(<div class={attrs.class} />, {} as JSX.Element)
expectType(<div style={attrs.style} />, {} as JSX.Element)

// @ts-expect-error invalid class value
;<div class={0} />

// #7955
expectType(<div style={[undefined, '', null, false]} />, {} as JSX.Element)

expectType(<div style={undefined} />, {} as JSX.Element)

expectType(<div style={null} />, {} as JSX.Element)

expectType(<div style={''} />, {} as JSX.Element)

expectType(<div style={false} />, {} as JSX.Element)

// @ts-expect-error
;<div style={[0]} />

// @ts-expect-error
;<div style={0} />

// @ts-expect-error unknown prop
;<div foo="bar" />

// allow key/ref on arbitrary element
expectType(<div key="foo" />, {} as JSX.Element)
expectType(<div ref="bar" />, {} as JSX.Element)

expectType(
  <input
    onInput={e => {
      // infer correct event type
      expectType(e.target, {} as EventTarget | null)
    }}
  />,
  {} as JSX.Element,
)

// built-in types
expectType(<Fragment />, {} as JSX.Element)
expectType(<Fragment key="1" />, {} as JSX.Element)

expectType(<Teleport to="#foo" />, {} as JSX.Element)
expectType(<Teleport to="#foo" key="1" />, {} as JSX.Element)

// @ts-expect-error
;<Teleport />
// @ts-expect-error
;<Teleport to={1} />

// KeepAlive
expectType(<KeepAlive include="foo" exclude={['a']} />, {} as JSX.Element)
expectType(<KeepAlive key="1" />, {} as JSX.Element)
// @ts-expect-error
;<KeepAlive include={123} />

// Suspense
expectType(<Suspense />, {} as JSX.Element)
expectType(<Suspense key="1" />, {} as JSX.Element)
expectType(
  <Suspense onResolve={() => {}} onFallback={() => {}} onPending={() => {}} />,
  {} as JSX.Element,
)
// @ts-expect-error
;<Suspense onResolve={123} />

// svg
expectType(
  <svg
    xmlnsXlink="http://www.w3.org/1999/xlink"
    xmlns="http://www.w3.org/2000/svg"
  />,
  {} as JSX.Element,
)
// details
expectType(<details name="details" />, {} as JSX.Element)
