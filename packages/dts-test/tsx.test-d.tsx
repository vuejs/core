// TSX w/ defineComponent is tested in defineComponent.test-d.tsx
import { KeepAlive, Suspense, Fragment, Teleport, VNode } from 'vue'
import { expectType } from './utils'

expectType<VNode>(<div />)
expectType<JSX.Element>(<div />)
expectType<JSX.Element>(<div id="foo" />)
expectType<JSX.Element>(<div>hello</div>)
expectType<JSX.Element>(<input value="foo" />)

// @ts-expect-error style css property validation
;<div style={{ unknown: 123 }} />

// allow array styles and nested array styles
expectType<JSX.Element>(<div style={[{ color: 'red' }]} />)
expectType<JSX.Element>(
  <div style={[{ color: 'red' }, [{ fontSize: '1em' }]]} />,
)

// allow undefined, string, object, array and nested array classes
expectType<JSX.Element>(<div class={undefined} />)
expectType<JSX.Element>(<div class={'foo'} />)
expectType<JSX.Element>(<div class={['foo', undefined, 'bar']} />)
expectType<JSX.Element>(<div class={[]} />)
expectType<JSX.Element>(<div class={['foo', ['bar'], [['baz']]]} />)
expectType<JSX.Element>(<div class={{ foo: true, bar: false, baz: true }} />)
expectType<JSX.Element>(<div class={{}} />)
expectType<JSX.Element>(
  <div class={['foo', ['bar'], { baz: true }, [{ qux: true }]]} />,
)
expectType<JSX.Element>(
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
)
expectType<JSX.Element>(
  <div
    class={[
      { foo: true },
      { bar: 'not-empty' },
      { baz: 1 },
      { qux: {} },
      { quux: [] },
    ]}
  />,
)

// #7955
expectType<JSX.Element>(<div style={[undefined, '', null, false]} />)

expectType<JSX.Element>(<div style={undefined} />)

expectType<JSX.Element>(<div style={null} />)

expectType<JSX.Element>(<div style={''} />)

expectType<JSX.Element>(<div style={false} />)

// @ts-expect-error
;<div style={[0]} />

// @ts-expect-error
;<div style={0} />

// @ts-expect-error unknown prop
;<div foo="bar" />

// allow key/ref on arbitrary element
expectType<JSX.Element>(<div key="foo" />)
expectType<JSX.Element>(<div ref="bar" />)

expectType<JSX.Element>(
  <input
    onInput={e => {
      // infer correct event type
      expectType<EventTarget | null>(e.target)
    }}
  />,
)

// built-in types
expectType<JSX.Element>(<Fragment />)
expectType<JSX.Element>(<Fragment key="1" />)

expectType<JSX.Element>(<Teleport to="#foo" />)
expectType<JSX.Element>(<Teleport to="#foo" key="1" />)

// @ts-expect-error
;<Teleport />
// @ts-expect-error
;<Teleport to={1} />

// KeepAlive
expectType<JSX.Element>(<KeepAlive include="foo" exclude={['a']} />)
expectType<JSX.Element>(<KeepAlive key="1" />)
// @ts-expect-error
;<KeepAlive include={123} />

// Suspense
expectType<JSX.Element>(<Suspense />)
expectType<JSX.Element>(<Suspense key="1" />)
expectType<JSX.Element>(
  <Suspense onResolve={() => {}} onFallback={() => {}} onPending={() => {}} />,
)
// @ts-expect-error
;<Suspense onResolve={123} />

// svg
expectType<JSX.Element>(
  <svg
    xmlnsXlink="http://www.w3.org/1999/xlink"
    xmlns="http://www.w3.org/2000/svg"
  />,
)
