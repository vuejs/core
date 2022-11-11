/** @jsx h */
import { h } from '@vue/jsx'
// TSX w/ defineComponent is tested in defineComponent.test-d.tsx
import {
  KeepAlive,
  Suspense,
  Fragment,
  Teleport,
  expectError,
  expectType,
  VNode
} from './index'

expectType<VNode>(<div />)
expectType<h.JSX.Element>(<div />)
expectType<h.JSX.Element>(<div id="foo" />)
expectType<h.JSX.Element>(<input value="foo" />)

// @ts-expect-error style css property validation
expectError(<div style={{ unknown: 123 }} />)

// allow array styles and nested array styles
expectType<h.JSX.Element>(<div style={[{ color: 'red' }]} />)
expectType<h.JSX.Element>(
  <div style={[{ color: 'red' }, [{ fontSize: '1em' }]]} />
)

// @ts-expect-error unknown prop
expectError(<div foo="bar" />)

// allow key/ref on arbitrary element
expectType<h.JSX.Element>(<div key="foo" />)
expectType<h.JSX.Element>(<div ref="bar" />)

expectType<h.JSX.Element>(
  <input
    onInput={e => {
      // infer correct event type
      expectType<EventTarget | null>(e.target)
    }}
  />
)

// built-in types
expectType<h.JSX.Element>(<Fragment />)
expectType<h.JSX.Element>(<Fragment key="1" />)

expectType<h.JSX.Element>(<Teleport to="#foo" />)
expectType<h.JSX.Element>(<Teleport to="#foo" key="1" />)

// @ts-expect-error
expectError(<Teleport />)
// @ts-expect-error
expectError(<Teleport to={1} />)

// KeepAlive
expectType<h.JSX.Element>(<KeepAlive include="foo" exclude={['a']} />)
expectType<h.JSX.Element>(<KeepAlive key="1" />)
// @ts-expect-error
expectError(<KeepAlive include={123} />)

// Suspense
expectType<h.JSX.Element>(<Suspense />)
expectType<h.JSX.Element>(<Suspense key="1" />)
expectType<h.JSX.Element>(
  <Suspense onResolve={() => {}} onFallback={() => {}} onPending={() => {}} />
)
// @ts-expect-error
expectError(<Suspense onResolve={123} />)
