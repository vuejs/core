// TSX w/ createComponent is tested in createComponent.test-d.tsx

import { expectError, expectType } from 'tsd'
import { KeepAlive, Suspense, Fragment, Portal } from '@vue/runtime-dom'

expectType<JSX.Element>(<div />)
expectType<JSX.Element>(<div id="foo" />)
expectType<JSX.Element>(<input value="foo" />)

// unknown prop
expectError(<div foo="bar" />)

// allow key/ref on arbitrary element
expectType<JSX.Element>(<div key="foo" />)
expectType<JSX.Element>(<div ref="bar" />)

expectType<JSX.Element>(
  <input
    onInput={e => {
      // infer correct event type
      expectType<EventTarget | null>(e.target)
    }}
  />
)

// built-in types
expectType<JSX.Element>(<Fragment />)
expectType<JSX.Element>(<Fragment key="1" />)

expectType<JSX.Element>(<Portal target="#foo" />)
// target is required
expectError(<Portal />)

// KeepAlive
expectType<JSX.Element>(<KeepAlive include="foo" exclude={['a']} />)
expectError(<KeepAlive include={123} />)

// Suspense
expectType<JSX.Element>(<Suspense />)
expectType<JSX.Element>(<Suspense onResolve={() => {}} onRecede={() => {}} />)
expectError(<Suspense onResolve={123} />)
